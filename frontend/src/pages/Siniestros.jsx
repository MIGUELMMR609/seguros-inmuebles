import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, AlertOctagon, Phone, Camera, CheckCircle,
  RefreshCw, X, ChevronDown, ChevronUp, ExternalLink, Shield, AlertTriangle, Loader2,
} from 'lucide-react';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import {
  obtenerSiniestrosApi, crearSiniestroApi, actualizarSiniestroApi, eliminarSiniestroApi,
  cerrarSiniestroApi, reabrirSiniestroApi, añadirLlamadaApi, eliminarLlamadaApi,
  subirFotosSiniestroApi, eliminarFotoSiniestroApi, obtenerPolizasApi, obtenerInmueblesApi,
  obtenerCoberturasPolizaApi,
} from '../api/index.js';

const formularioVacio = {
  inmueble_id: '', poliza_id: '',
  fecha_apertura: new Date().toISOString().split('T')[0],
  motivo: '', numero_siniestro: '', persona_contacto: '',
  compania_aseguradora: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '',
  notas: '',
};

const llamadaVacia = { fecha: new Date().toISOString().split('T')[0], descripcion: '', resultado: '' };

export default function Siniestros() {
  const [searchParams] = useSearchParams();
  const polizaIdFiltro = searchParams.get('poliza_id') || '';

  const [siniestros, setSiniestros] = useState([]);
  const [polizas, setPolizas] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroPol, setFiltroPol] = useState(polizaIdFiltro);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [toast, setToast] = useState(null);

  // Modales
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  // Coberturas
  const [coberturas, setCoberturas] = useState([]);
  const [cargandoCoberturas, setCargandoCoberturas] = useState(false);
  const [infoCoberturas, setInfoCoberturas] = useState({ tiene_documento: null, archivo_disponible: false });
  const [mostrarCoberturas, setMostrarCoberturas] = useState(false);

  // Detalle
  const [modalDetalle, setModalDetalle] = useState(false);
  const [siniestroDetalle, setSiniestroDetalle] = useState(null);
  const [llamadaForm, setLlamadaForm] = useState(llamadaVacia);
  const [añadiendoLlamada, setAñadiendoLlamada] = useState(false);
  const [mostrarFormLlamada, setMostrarFormLlamada] = useState(false);
  const fotoInputRef = useRef(null);
  const [subiendoFotos, setSubiendoFotos] = useState(false);

  async function cargar() {
    try {
      const [resSin, resPol, resInm] = await Promise.all([
        obtenerSiniestrosApi({
          poliza_id: filtroPol || undefined,
          estado: filtroEstado || undefined,
        }),
        obtenerPolizasApi(),
        obtenerInmueblesApi(),
      ]);
      setSiniestros(resSin.data);
      setPolizas(resPol.data);
      setInmuebles(resInm.data);
    } catch {
      setToast({ mensaje: 'Error al cargar los siniestros', tipo: 'error' });
    } finally {
      setCargando(false);
    }
  }

  function polizasDeInmueble(inmuebleId) {
    return polizas.filter((p) => String(p.inmueble_id) === String(inmuebleId));
  }

  function polizaActivaDeInmueble(inmuebleId) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const del = polizasDeInmueble(inmuebleId);
    const activas = del.filter((p) => !p.fecha_vencimiento || new Date(p.fecha_vencimiento) >= hoy);
    const ordenadas = (activas.length ? activas : del).sort((a, b) => {
      if (a.fecha_vencimiento && b.fecha_vencimiento)
        return new Date(b.fecha_vencimiento) - new Date(a.fecha_vencimiento);
      return b.id - a.id;
    });
    return ordenadas[0] || null;
  }

  function autorellenarDesdePoliza(poliza) {
    if (!poliza) return {};
    return {
      poliza_id: poliza.id,
      compania_aseguradora: poliza.compania_aseguradora || '',
      contacto_nombre: poliza.contacto_nombre || '',
      contacto_telefono: poliza.contacto_telefono || '',
      contacto_email: poliza.contacto_email || '',
    };
  }

  async function fetchCoberturas(polizaId) {
    setCoberturas([]);
    setInfoCoberturas({ tiene_documento: null, archivo_disponible: false });
    setMostrarCoberturas(false);
    if (!polizaId) return;
    setCargandoCoberturas(true);
    setMostrarCoberturas(true);
    try {
      const res = await obtenerCoberturasPolizaApi(polizaId);
      const { tiene_documento, archivo_disponible, coberturas: lista } = res.data;
      setCoberturas(lista || []);
      setInfoCoberturas({ tiene_documento, archivo_disponible: archivo_disponible ?? true });
    } catch {
      setInfoCoberturas({ tiene_documento: true, archivo_disponible: false });
    } finally {
      setCargandoCoberturas(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroPol, filtroEstado]);

  // Sincronizar filtro con URL
  useEffect(() => { setFiltroPol(polizaIdFiltro); }, [polizaIdFiltro]);

  function abrirCrear() {
    setEditando(null);
    setCoberturas([]);
    setInfoCoberturas({ tiene_documento: null, archivo_disponible: false });
    setMostrarCoberturas(false);
    let base = { ...formularioVacio };
    if (filtroPol) {
      const poliza = polizas.find((p) => String(p.id) === String(filtroPol));
      if (poliza) {
        base = { ...base, inmueble_id: poliza.inmueble_id || '', ...autorellenarDesdePoliza(poliza) };
        fetchCoberturas(poliza.id);
      }
    }
    setFormulario(base);
    setErrorForm('');
    setModalForm(true);
  }

  function abrirEditar(s) {
    setEditando(s);
    setCoberturas([]);
    setInfoCoberturas({ tiene_documento: null, archivo_disponible: false });
    setMostrarCoberturas(false);
    const poliza = polizas.find((p) => p.id === s.poliza_id);
    setFormulario({
      inmueble_id: poliza?.inmueble_id || s.inmueble_id || '',
      poliza_id: s.poliza_id || '',
      fecha_apertura: s.fecha_apertura?.split('T')[0] || '',
      motivo: s.motivo || '',
      numero_siniestro: s.numero_siniestro || '',
      persona_contacto: s.persona_contacto || '',
      compania_aseguradora: s.compania_aseguradora || '',
      contacto_nombre: s.contacto_nombre || '',
      contacto_telefono: s.contacto_telefono || '',
      contacto_email: s.contacto_email || '',
      notas: s.notas || '',
    });
    if (s.poliza_id) fetchCoberturas(s.poliza_id);
    setErrorForm('');
    setModalForm(true);
  }

  function cerrarModalForm() {
    setModalForm(false);
    setEditando(null);
    setErrorForm('');
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!formulario.inmueble_id) { setErrorForm('Debes seleccionar un inmueble'); return; }
    if (!formulario.poliza_id) { setErrorForm('El inmueble seleccionado no tiene pólizas registradas'); return; }
    setGuardando(true);
    setErrorForm('');
    try {
      if (editando) {
        await actualizarSiniestroApi(editando.id, formulario);
        setToast({ mensaje: 'Siniestro actualizado', tipo: 'success' });
      } else {
        await crearSiniestroApi(formulario);
        setToast({ mensaje: 'Siniestro creado correctamente', tipo: 'success' });
      }
      await cargar();
      cerrarModalForm();
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'Error al guardar el siniestro');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    try {
      await eliminarSiniestroApi(id);
      setConfirmandoEliminar(null);
      setToast({ mensaje: 'Siniestro eliminado', tipo: 'success' });
      await cargar();
    } catch {
      setToast({ mensaje: 'Error al eliminar el siniestro', tipo: 'error' });
    }
  }

  async function handleCambiarEstado(siniestro) {
    try {
      if (siniestro.estado === 'abierto') {
        await cerrarSiniestroApi(siniestro.id);
        setToast({ mensaje: 'Siniestro cerrado', tipo: 'success' });
      } else {
        await reabrirSiniestroApi(siniestro.id);
        setToast({ mensaje: 'Siniestro reabierto', tipo: 'info' });
      }
      await cargar();
      // Actualizar detalle si está abierto
      if (siniestroDetalle?.id === siniestro.id) {
        const res = await obtenerSiniestrosApi({ poliza_id: siniestro.poliza_id });
        const actualizado = res.data.find((s) => s.id === siniestro.id);
        if (actualizado) setSiniestroDetalle(actualizado);
      }
    } catch {
      setToast({ mensaje: 'Error al cambiar el estado', tipo: 'error' });
    }
  }

  // --- Detalle ---
  function abrirDetalle(s) {
    setSiniestroDetalle(s);
    setLlamadaForm(llamadaVacia);
    setMostrarFormLlamada(false);
    setModalDetalle(true);
  }

  async function handleAñadirLlamada(e) {
    e.preventDefault();
    if (!llamadaForm.descripcion) return;
    setAñadiendoLlamada(true);
    try {
      const res = await añadirLlamadaApi(siniestroDetalle.id, llamadaForm);
      setSiniestroDetalle(res.data);
      setLlamadaForm(llamadaVacia);
      setMostrarFormLlamada(false);
      await cargar();
    } catch {
      setToast({ mensaje: 'Error al añadir la llamada', tipo: 'error' });
    } finally {
      setAñadiendoLlamada(false);
    }
  }

  async function handleEliminarLlamada(indice) {
    try {
      const res = await eliminarLlamadaApi(siniestroDetalle.id, indice);
      setSiniestroDetalle(res.data);
      await cargar();
    } catch {
      setToast({ mensaje: 'Error al eliminar la llamada', tipo: 'error' });
    }
  }

  async function handleSubirFotos(e) {
    const archivos = Array.from(e.target.files);
    if (!archivos.length) return;
    setSubiendoFotos(true);
    try {
      const res = await subirFotosSiniestroApi(siniestroDetalle.id, archivos);
      setSiniestroDetalle(res.data);
      await cargar();
      setToast({ mensaje: `${archivos.length} foto(s) subida(s)`, tipo: 'success' });
    } catch {
      setToast({ mensaje: 'Error al subir las fotos', tipo: 'error' });
    } finally {
      setSubiendoFotos(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  }

  async function handleEliminarFoto(indice) {
    try {
      const res = await eliminarFotoSiniestroApi(siniestroDetalle.id, indice);
      setSiniestroDetalle(res.data);
      await cargar();
    } catch {
      setToast({ mensaje: 'Error al eliminar la foto', tipo: 'error' });
    }
  }

  const columnas = [
    {
      clave: 'nombre_inmueble', titulo: 'Inmueble',
      render: (f) => <span className="font-medium">{f.nombre_inmueble || '—'}</span>,
    },
    { clave: 'numero_poliza', titulo: 'Póliza', render: (f) => <span className="font-mono text-sm">{f.numero_poliza || '—'}</span> },
    { clave: 'numero_siniestro', titulo: 'Nº Siniestro', render: (f) => f.numero_siniestro || '—' },
    {
      clave: 'fecha_apertura', titulo: 'Apertura',
      render: (f) => f.fecha_apertura ? new Date(f.fecha_apertura).toLocaleDateString('es-ES') : '—',
    },
    { clave: 'motivo', titulo: 'Motivo', render: (f) => <span className="truncate max-w-[200px] block">{f.motivo || '—'}</span> },
    {
      clave: 'estado', titulo: 'Estado',
      render: (f) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${f.estado === 'abierto' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
          {f.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
        </span>
      ),
    },
    {
      clave: 'llamadas', titulo: 'Llamadas',
      render: (f) => <span className="text-sm font-medium">{(f.llamadas || []).length}</span>,
    },
    {
      clave: 'acciones', titulo: 'Acciones', ancho: '140px',
      render: (f) => (
        <div className="flex items-center gap-1">
          <button onClick={() => abrirDetalle(f)} title="Ver detalle" className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
            <Phone size={14} />
          </button>
          <button onClick={() => abrirEditar(f)} title="Editar" className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleCambiarEstado(f)}
            title={f.estado === 'abierto' ? 'Cerrar siniestro' : 'Reabrir siniestro'}
            className={`p-1.5 rounded-lg transition-colors ${f.estado === 'abierto' ? 'text-gray-400 hover:text-green-600 hover:bg-green-50' : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'}`}
          >
            {f.estado === 'abierto' ? <CheckCircle size={14} /> : <RefreshCw size={14} />}
          </button>
          <button onClick={() => setConfirmandoEliminar(f)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} />
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
            <AlertOctagon size={24} className="text-[#1e3a5f]" />
            Siniestros
          </h1>
          <p className="text-gray-500 text-sm mt-1">{siniestros.length} siniestros</p>
        </div>
        <button onClick={abrirCrear} className="btn-primario"><Plus size={16} /> Nuevo siniestro</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filtroPol} onChange={(e) => setFiltroPol(e.target.value)} className="campo-formulario w-auto min-w-[200px]">
          <option value="">Todas las pólizas</option>
          {polizas.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre_inmueble} — {p.numero_poliza || `#${p.id}`}</option>
          ))}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="campo-formulario w-auto">
          <option value="">Todos los estados</option>
          <option value="abierto">Abiertos</option>
          <option value="cerrado">Cerrados</option>
        </select>
      </div>

      <div className="tarjeta">
        <Tabla columnas={columnas} datos={siniestros} cargando={cargando} mensajeVacio="No hay siniestros registrados." />
      </div>

      {/* Modal alta/edición */}
      <Modal abierto={modalForm} onCerrar={cerrarModalForm} titulo={editando ? 'Editar siniestro' : 'Nuevo siniestro'} ancho="max-w-xl">
        <form onSubmit={handleGuardar} className="space-y-4">
          {/* Inmueble */}
          <div>
            <label className="etiqueta-formulario">Inmueble *</label>
            <select
              value={formulario.inmueble_id}
              onChange={(e) => {
                const inmuebleId = e.target.value;
                const poliza = inmuebleId ? polizaActivaDeInmueble(inmuebleId) : null;
                setFormulario((prev) => ({
                  ...prev,
                  inmueble_id: inmuebleId,
                  ...autorellenarDesdePoliza(poliza),
                }));
                fetchCoberturas(poliza?.id || null);
              }}
              className="campo-formulario"
            >
              <option value="">Selecciona un inmueble</option>
              {inmuebles.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>

          {/* Póliza (filtrada al inmueble seleccionado) */}
          {formulario.inmueble_id && (
            <div>
              <label className="etiqueta-formulario">Póliza</label>
              <select
                value={formulario.poliza_id}
                onChange={(e) => {
                  const poliza = polizas.find((p) => String(p.id) === e.target.value);
                  setFormulario((prev) => ({
                    ...prev,
                    ...autorellenarDesdePoliza(poliza),
                  }));
                  fetchCoberturas(poliza?.id || null);
                }}
                className="campo-formulario"
              >
                <option value="">Sin póliza específica</option>
                {polizasDeInmueble(formulario.inmueble_id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.numero_poliza || `Póliza #${p.id}`} — {p.tipo}{p.fecha_vencimiento ? ` (vence ${new Date(p.fecha_vencimiento).toLocaleDateString('es-ES')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Datos de contacto de la aseguradora (auto-relleno, editable) */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Datos de la aseguradora</p>
            <div>
              <label className="etiqueta-formulario">Compañía aseguradora</label>
              <input
                value={formulario.compania_aseguradora}
                onChange={(e) => setFormulario((p) => ({ ...p, compania_aseguradora: e.target.value }))}
                className="campo-formulario" placeholder="Mapfre, Allianz..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="etiqueta-formulario">Nombre del contacto</label>
                <input
                  value={formulario.contacto_nombre}
                  onChange={(e) => setFormulario((p) => ({ ...p, contacto_nombre: e.target.value }))}
                  className="campo-formulario" placeholder="Gestor de siniestros" />
              </div>
              <div>
                <label className="etiqueta-formulario">Teléfono</label>
                <input
                  value={formulario.contacto_telefono}
                  onChange={(e) => setFormulario((p) => ({ ...p, contacto_telefono: e.target.value }))}
                  className="campo-formulario" placeholder="600 000 000" />
              </div>
            </div>
            <div>
              <label className="etiqueta-formulario">Email de contacto</label>
              <input
                type="email"
                value={formulario.contacto_email}
                onChange={(e) => setFormulario((p) => ({ ...p, contacto_email: e.target.value }))}
                className="campo-formulario" placeholder="siniestros@aseguradora.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="etiqueta-formulario">Fecha de apertura</label>
              <input type="date" value={formulario.fecha_apertura}
                onChange={(e) => setFormulario((p) => ({ ...p, fecha_apertura: e.target.value }))}
                className="campo-formulario" />
            </div>
            <div>
              <label className="etiqueta-formulario">Número de siniestro</label>
              <input value={formulario.numero_siniestro}
                onChange={(e) => setFormulario((p) => ({ ...p, numero_siniestro: e.target.value }))}
                className="campo-formulario font-mono" placeholder="SIN-2024-XXXX" />
            </div>
          </div>
          {/* Coberturas de la póliza */}
          {formulario.poliza_id && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setMostrarCoberturas((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
              >
                <span className="flex items-center gap-2">
                  <Shield size={14} className="text-indigo-500" />
                  Coberturas de la póliza
                  {coberturas.length > 0 && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                      {coberturas.length}
                    </span>
                  )}
                </span>
                {cargandoCoberturas
                  ? <Loader2 size={14} className="animate-spin text-gray-400" />
                  : mostrarCoberturas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {mostrarCoberturas && (
                <div className="px-4 py-3 bg-white border-t border-gray-100">
                  {cargandoCoberturas ? (
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <Loader2 size={13} className="animate-spin" /> Analizando PDF de la póliza con IA...
                    </p>
                  ) : infoCoberturas.tiene_documento === false ? (
                    <p className="text-sm text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> No hay PDF de póliza disponible para analizar coberturas
                    </p>
                  ) : infoCoberturas.archivo_disponible === false ? (
                    <p className="text-sm text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> El archivo PDF no está disponible en el servidor
                    </p>
                  ) : coberturas.length === 0 ? (
                    <p className="text-sm text-gray-400">No se detectaron coberturas específicas en el PDF</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {coberturas.map((c, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cobertura afectada (selector rápido desde las coberturas detectadas) */}
          {coberturas.length > 0 && (
            <div>
              <label className="etiqueta-formulario">Cobertura afectada (opcional)</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setFormulario((p) => ({ ...p, motivo: e.target.value }));
                  }
                }}
                className="campo-formulario"
              >
                <option value="">— Seleccionar cobertura como motivo —</option>
                {coberturas.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="etiqueta-formulario">Motivo / descripción</label>
            <textarea value={formulario.motivo}
              onChange={(e) => setFormulario((p) => ({ ...p, motivo: e.target.value }))}
              rows={3} className="campo-formulario resize-none" placeholder="Describe el siniestro..." />
          </div>
          <div>
            <label className="etiqueta-formulario">Notas internas</label>
            <textarea value={formulario.notas}
              onChange={(e) => setFormulario((p) => ({ ...p, notas: e.target.value }))}
              rows={2} className="campo-formulario resize-none" placeholder="Observaciones..." />
          </div>
          {errorForm && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{errorForm}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={cerrarModalForm} className="btn-secundario flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primario flex-1 justify-center">
              {guardando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : editando ? 'Guardar cambios' : 'Crear siniestro'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal detalle */}
      <Modal abierto={modalDetalle} onCerrar={() => setModalDetalle(false)} titulo={`Siniestro ${siniestroDetalle?.numero_siniestro || `#${siniestroDetalle?.id}`}`} ancho="max-w-2xl">
        {siniestroDetalle && (
          <div className="space-y-6">
            {/* Info básica */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm grid grid-cols-2 gap-2 text-gray-700">
              <div><span className="text-gray-400">Inmueble:</span> <strong>{siniestroDetalle.nombre_inmueble || '—'}</strong></div>
              <div><span className="text-gray-400">Póliza:</span> {siniestroDetalle.numero_poliza || '—'}</div>
              <div><span className="text-gray-400">Apertura:</span> {siniestroDetalle.fecha_apertura ? new Date(siniestroDetalle.fecha_apertura).toLocaleDateString('es-ES') : '—'}</div>
              <div><span className="text-gray-400">Estado:</span>
                <span className={`ml-1 font-semibold ${siniestroDetalle.estado === 'abierto' ? 'text-orange-600' : 'text-green-600'}`}>
                  {siniestroDetalle.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
              {siniestroDetalle.compania_aseguradora && (
                <div className="col-span-2"><span className="text-gray-400">Compañía:</span> <strong>{siniestroDetalle.compania_aseguradora}</strong></div>
              )}
              {siniestroDetalle.contacto_nombre && (
                <div><span className="text-gray-400">Contacto:</span> {siniestroDetalle.contacto_nombre}</div>
              )}
              {siniestroDetalle.contacto_telefono && (
                <div><span className="text-gray-400">Teléfono:</span> <a href={`tel:${siniestroDetalle.contacto_telefono}`} className="text-[#1e3a5f] hover:underline">{siniestroDetalle.contacto_telefono}</a></div>
              )}
              {siniestroDetalle.contacto_email && (
                <div className="col-span-2"><span className="text-gray-400">Email:</span> <a href={`mailto:${siniestroDetalle.contacto_email}`} className="text-[#1e3a5f] hover:underline">{siniestroDetalle.contacto_email}</a></div>
              )}
              {siniestroDetalle.motivo && (
                <div className="col-span-2"><span className="text-gray-400">Motivo:</span> {siniestroDetalle.motivo}</div>
              )}
            </div>

            {/* Llamadas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Phone size={16} /> Registro de llamadas</h3>
                <button onClick={() => setMostrarFormLlamada((v) => !v)} className="text-sm text-[#1e3a5f] font-medium flex items-center gap-1 hover:underline">
                  {mostrarFormLlamada ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Añadir llamada
                </button>
              </div>

              {mostrarFormLlamada && (
                <form onSubmit={handleAñadirLlamada} className="bg-blue-50 rounded-lg p-4 mb-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="etiqueta-formulario">Fecha</label>
                      <input type="date" value={llamadaForm.fecha}
                        onChange={(e) => setLlamadaForm((p) => ({ ...p, fecha: e.target.value }))}
                        className="campo-formulario" />
                    </div>
                    <div>
                      <label className="etiqueta-formulario">Resultado</label>
                      <input value={llamadaForm.resultado}
                        onChange={(e) => setLlamadaForm((p) => ({ ...p, resultado: e.target.value }))}
                        className="campo-formulario" placeholder="Pendiente, resuelto..." />
                    </div>
                  </div>
                  <div>
                    <label className="etiqueta-formulario">Descripción *</label>
                    <textarea value={llamadaForm.descripcion}
                      onChange={(e) => setLlamadaForm((p) => ({ ...p, descripcion: e.target.value }))}
                      rows={2} className="campo-formulario resize-none" placeholder="Resumen de la llamada..." />
                  </div>
                  <button type="submit" disabled={añadiendoLlamada || !llamadaForm.descripcion} className="btn-primario text-sm">
                    {añadiendoLlamada ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Añadir'}
                  </button>
                </form>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(siniestroDetalle.llamadas || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sin llamadas registradas</p>
                ) : (
                  [...(siniestroDetalle.llamadas || [])].reverse().map((ll, i, arr) => {
                    const indiceReal = arr.length - 1 - i;
                    return (
                      <div key={indiceReal} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400">{new Date(ll.fecha).toLocaleDateString('es-ES')}</span>
                            {ll.resultado && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{ll.resultado}</span>}
                          </div>
                          <p className="text-gray-700">{ll.descripcion}</p>
                        </div>
                        <button onClick={() => handleEliminarLlamada(indiceReal)} className="text-gray-300 hover:text-red-500 flex-shrink-0 mt-0.5">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Fotos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Camera size={16} /> Fotos</h3>
                <button
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={subiendoFotos}
                  className="btn-secundario text-sm py-1.5"
                >
                  {subiendoFotos ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600" /> : <Plus size={14} />}
                  {subiendoFotos ? 'Subiendo...' : 'Añadir fotos'}
                </button>
                <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSubirFotos} />
              </div>
              {(siniestroDetalle.fotos || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin fotos</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(siniestroDetalle.fotos || []).map((url, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-gray-100">
                      <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-white bg-white/20 rounded p-1">
                          <ExternalLink size={14} />
                        </a>
                        <button onClick={() => handleEliminarFoto(i)} className="text-white bg-red-500/80 rounded p-1">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón cerrar/reabrir */}
            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => handleCambiarEstado(siniestroDetalle)}
                className={siniestroDetalle.estado === 'abierto' ? 'btn-primario' : 'btn-secundario'}
              >
                {siniestroDetalle.estado === 'abierto' ? <><CheckCircle size={15} /> Cerrar parte</> : <><RefreshCw size={15} /> Reabrir parte</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal eliminar */}
      <Modal abierto={!!confirmandoEliminar} onCerrar={() => setConfirmandoEliminar(null)} titulo="Confirmar eliminación" ancho="max-w-sm">
        <p className="text-gray-600 text-sm mb-6">¿Eliminar el siniestro <strong>{confirmandoEliminar?.numero_siniestro || `#${confirmandoEliminar?.id}`}</strong>?</p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmandoEliminar(null)} className="btn-secundario flex-1">Cancelar</button>
          <button onClick={() => handleEliminar(confirmandoEliminar.id)} className="btn-peligro flex-1 justify-center">Eliminar</button>
        </div>
      </Modal>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  );
}
