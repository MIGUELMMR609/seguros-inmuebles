import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, FileText, AlertTriangle, Sparkles, RefreshCw, Download, Scale } from 'lucide-react';
import { imprimirInformePoliza } from '../utils/imprimirInforme.js';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import ModalComparador from '../components/ModalComparador.jsx';
import UploadPDF from '../components/UploadPDF.jsx';
import AnalizadorPDF from '../components/AnalizadorPDF.jsx';
import Toast from '../components/Toast.jsx';
import {
  obtenerPolizasInquilinosApi,
  crearPolizaInquilinoApi,
  actualizarPolizaInquilinoApi,
  eliminarPolizaInquilinoApi,
  obtenerInquilinosApi,
  analizarExpertoPolizaInquilinoApi,
  compararPolizasApi,
} from '../api/index.js';

const TIPOS_POLIZA = [
  { valor: 'hogar', etiqueta: 'Hogar' },
  { valor: 'local_negocio', etiqueta: 'Local de Negocio' },
  { valor: 'responsabilidad_civil', etiqueta: 'Responsabilidad Civil' },
  { valor: 'vida', etiqueta: 'Vida' },
  { valor: 'accidentes', etiqueta: 'Accidentes' },
  { valor: 'otros', etiqueta: 'Otros' },
];

const API_BASE = import.meta.env.VITE_API_URL || '';
function urlDoc(url) {
  if (!url) return url;
  return url.startsWith('/') ? API_BASE + url : url;
}

const formularioVacio = {
  inquilino_id: '',
  tipo: 'hogar',
  compania_aseguradora: '',
  numero_poliza: '',
  fecha_inicio: '',
  fecha_vencimiento: '',
  importe_anual: '',
  notas: '',
  documento_url: '',
  tomador_poliza: '',
  contacto_nombre: '',
  contacto_telefono: '',
  contacto_email: '',
  riesgos_cubiertos: '',
  riesgos_no_cubiertos: '',
  analisis_fortalezas: '',
  analisis_carencias: '',
  como_complementar: '',
  direccion_bien_asegurado: '',
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
  const [toast, setToast] = useState(null);

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pasoModal, setPasoModal] = useState('pdf');
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  // Modal análisis experto IA
  const [modalAnalisis, setModalAnalisis] = useState(false);
  const [polizaAnalisis, setPolizaAnalisis] = useState(null);
  const [analisisActual, setAnalisisActual] = useState(null);
  const [analizando, setAnalizando] = useState(false);

  // Análisis experto desde el formulario
  const [analizandoForm, setAnalizandoForm] = useState(false);

  // Comparador de pólizas con IA
  const [modoComparar, setModoComparar] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [comparando, setComparando] = useState(false);
  const [resultadoComparacion, setResultadoComparacion] = useState(null);

  async function cargar() {
    try {
      const [resPolizas, resInquilinos, resTodas] = await Promise.all([
        obtenerPolizasInquilinosApi(filtroInquilino ? { inquilino_id: filtroInquilino } : {}),
        obtenerInquilinosApi(),
        obtenerPolizasInquilinosApi({}),
      ]);
      setPolizas(resPolizas.data);
      setInquilinos(resInquilinos.data);

      const conPolizaActiva = new Set(
        resTodas.data
          .filter((p) => !p.fecha_vencimiento || new Date(p.fecha_vencimiento) >= new Date())
          .map((p) => p.inquilino_id)
      );
      setInquilinosSinSeguro(resInquilinos.data.filter((inq) => !conPolizaActiva.has(inq.id)));
    } catch {
      setToast({ mensaje: 'Error al cargar los datos', tipo: 'error' });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroInquilino]);

  function abrirCrear() {
    setEditando(null);
    setFormulario(formularioVacio);
    setError('');
    setPasoModal('pdf');
    setModalAbierto(true);
  }

  function abrirEditar(poliza) {
    setEditando(poliza);
    setFormulario({
      inquilino_id: poliza.inquilino_id || '',
      tipo: poliza.tipo || 'hogar',
      compania_aseguradora: poliza.compania_aseguradora || '',
      numero_poliza: poliza.numero_poliza || '',
      fecha_inicio: poliza.fecha_inicio ? poliza.fecha_inicio.split('T')[0] : '',
      fecha_vencimiento: poliza.fecha_vencimiento ? poliza.fecha_vencimiento.split('T')[0] : '',
      importe_anual: poliza.importe_anual || '',
      notas: poliza.notas || '',
      documento_url: poliza.documento_url || '',
      tomador_poliza: poliza.tomador_poliza || '',
      contacto_nombre: poliza.contacto_nombre || '',
      contacto_telefono: poliza.contacto_telefono || '',
      contacto_email: poliza.contacto_email || '',
      riesgos_cubiertos: poliza.riesgos_cubiertos || '',
      riesgos_no_cubiertos: poliza.riesgos_no_cubiertos || '',
      analisis_fortalezas: poliza.analisis_fortalezas || '',
      analisis_carencias: poliza.analisis_carencias || '',
      como_complementar: poliza.como_complementar || '',
      direccion_bien_asegurado: poliza.direccion_bien_asegurado || '',
    });
    setError('');
    setPasoModal('form');
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setError('');
  }

  function handleDatosIA(datos, documentoUrl) {
    setFormulario((prev) => ({
      ...prev,
      compania_aseguradora: datos.compania_aseguradora || prev.compania_aseguradora,
      numero_poliza: datos.numero_poliza || prev.numero_poliza,
      tipo: datos.tipo || prev.tipo,
      fecha_inicio: datos.fecha_inicio || prev.fecha_inicio,
      fecha_vencimiento: datos.fecha_vencimiento || prev.fecha_vencimiento,
      importe_anual: datos.importe_anual != null ? String(datos.importe_anual) : prev.importe_anual,
      contacto_nombre: datos.contacto_nombre || prev.contacto_nombre,
      contacto_telefono: datos.contacto_telefono || prev.contacto_telefono,
      contacto_email: datos.contacto_email || prev.contacto_email,
      riesgos_cubiertos: datos.riesgos_cubiertos || prev.riesgos_cubiertos,
      riesgos_no_cubiertos: datos.riesgos_no_cubiertos || prev.riesgos_no_cubiertos,
      analisis_fortalezas: datos.analisis_fortalezas || prev.analisis_fortalezas,
      analisis_carencias: datos.analisis_carencias || prev.analisis_carencias,
      como_complementar: datos.como_complementar || prev.como_complementar,
      direccion_bien_asegurado: datos.direccion_bien_asegurado || prev.direccion_bien_asegurado,
      documento_url: documentoUrl || prev.documento_url,
    }));
    setPasoModal('form');
  }

  function handleCambio(e) {
    setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!formulario.inquilino_id) {
      setToast({ mensaje: 'Debes seleccionar un inquilino antes de guardar la póliza', tipo: 'error' });
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
        setToast({ mensaje: 'Póliza actualizada correctamente', tipo: 'success' });
      } else {
        await crearPolizaInquilinoApi(datos);
        setToast({ mensaje: 'Póliza creada correctamente', tipo: 'success' });
      }
      await cargar();
      window.dispatchEvent(new CustomEvent('refreshBadges'));
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
      setToast({ mensaje: 'Póliza eliminada correctamente', tipo: 'success' });
      await cargar();
      window.dispatchEvent(new CustomEvent('refreshBadges'));
    } catch (err) {
      setToast({ mensaje: err.response?.data?.error || 'Error al eliminar la póliza', tipo: 'error' });
    }
  }

  // --- Análisis experto IA ---
  function abrirAnalisis(poliza) {
    setPolizaAnalisis(poliza);
    if (poliza.fecha_ultimo_analisis) {
      setAnalisisActual({
        valoracion: poliza.valoracion,
        riesgos_cubiertos: poliza.riesgos_cubiertos,
        riesgos_no_cubiertos: poliza.riesgos_no_cubiertos,
        analisis_fortalezas: poliza.analisis_fortalezas,
        analisis_carencias: poliza.analisis_carencias,
        como_complementar: poliza.como_complementar,
        comparador_mercado: poliza.comparador_mercado,
        fecha_ultimo_analisis: poliza.fecha_ultimo_analisis,
      });
    } else {
      setAnalisisActual(null);
    }
    setModalAnalisis(true);
  }

  async function handleAnalizarExperto() {
    setAnalizando(true);
    try {
      const res = await analizarExpertoPolizaInquilinoApi(polizaAnalisis.id);
      setAnalisisActual(res.data);
      await cargar();
      window.dispatchEvent(new CustomEvent('refreshBadges'));
    } catch (err) {
      setToast({ mensaje: err.response?.data?.error || 'Error al analizar la póliza', tipo: 'error' });
    } finally {
      setAnalizando(false);
    }
  }

  async function handleAnalizarEnFormulario() {
    if (!editando?.id) return;
    setAnalizandoForm(true);
    try {
      const res = await analizarExpertoPolizaInquilinoApi(editando.id);
      const d = res.data;
      setFormulario((prev) => ({
        ...prev,
        riesgos_cubiertos: d.riesgos_cubiertos || prev.riesgos_cubiertos,
        riesgos_no_cubiertos: d.riesgos_no_cubiertos || prev.riesgos_no_cubiertos,
        analisis_fortalezas: d.analisis_fortalezas || prev.analisis_fortalezas,
        analisis_carencias: d.analisis_carencias || prev.analisis_carencias,
        como_complementar: d.como_complementar || prev.como_complementar,
      }));
      setToast({ mensaje: 'Análisis completado. Revisa los campos y guarda.', tipo: 'success' });
    } catch (err) {
      setToast({ mensaje: err.response?.data?.error || 'Error al analizar la póliza', tipo: 'error' });
    } finally {
      setAnalizandoForm(false);
    }
  }

  async function handleComparar() {
    setComparando(true);
    try {
      const res = await compararPolizasApi(seleccionadas, 'inquilinos');
      setResultadoComparacion(res.data);
    } catch (err) {
      setToast({ mensaje: err.response?.data?.error || 'Error al comparar pólizas', tipo: 'error' });
    } finally {
      setComparando(false);
    }
  }

  function toggleSeleccion(id) {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
    {
      clave: 'tomador_poliza', titulo: 'Tomador',
      render: (f) => f.tomador_poliza || '—',
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
        <a href={urlDoc(f.documento_url)} target="_blank" rel="noopener noreferrer" title="Ver documento PDF" className="inline-flex p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
          <FileText size={20} />
        </a>
      ) : '—',
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '140px',
      render: (f) => (
        <div className="flex items-center gap-1">
          <button onClick={() => abrirEditar(f)} title="Editar" className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
            <Pencil size={20} />
          </button>
          <button onClick={() => abrirAnalisis(f)} title="Análisis experto IA" className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
            <Sparkles size={20} />
          </button>
          <button onClick={() => setConfirmandoEliminar(f)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={20} />
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
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filtroInquilino} onChange={(e) => setFiltroInquilino(e.target.value)} className="campo-formulario w-full sm:w-auto sm:min-w-[200px]">
          <option value="">Todos los inquilinos</option>
          {inquilinos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <button
          onClick={() => { setModoComparar((v) => !v); setSeleccionadas([]); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            modoComparar
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
          }`}
        >
          <Scale size={15} />
          Comparar pólizas
        </button>
      </div>

      {/* Panel de selección para comparar */}
      {modoComparar && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-3">
            Selecciona 2 o más pólizas para comparar ({seleccionadas.length} seleccionadas)
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
            {polizas.map((p) => (
              <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seleccionadas.includes(p.id)}
                  onChange={() => toggleSeleccion(p.id)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">{p.compania_aseguradora || 'Sin compañía'}</span>
                  {p.numero_poliza && <span className="text-gray-400 font-mono text-xs ml-2">· {p.numero_poliza}</span>}
                  {p.nombre_inquilino && <span className="text-gray-500 ml-2">· {p.nombre_inquilino}</span>}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleComparar}
              disabled={seleccionadas.length < 2 || comparando}
              className="btn-primario disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {comparando ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Comparando...</>
              ) : (
                <><Scale size={15} /> Comparar seleccionadas ({seleccionadas.length})</>
              )}
            </button>
            <button
              onClick={() => { setModoComparar(false); setSeleccionadas([]); }}
              className="btn-secundario"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <Tabla columnas={columnas} datos={polizas} cargando={cargando} mensajeVacio="No hay pólizas de inquilinos registradas." filasPorPagina={9999} />
      </div>

      {/* Modal alta/edición */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editando ? 'Editar póliza de inquilino' : 'Nueva póliza de inquilino'}
        ancho="max-w-3xl"
      >
        {pasoModal === 'pdf' && !editando ? (
          <AnalizadorPDF
            onDatosExtraidos={handleDatosIA}
            onOmitir={() => setPasoModal('form')}
          />
        ) : (
          <form onSubmit={handleGuardar} className="space-y-5">
            {/* Datos básicos */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos básicos</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="etiqueta-formulario">Inquilino *</label>
                  <select name="inquilino_id" value={formulario.inquilino_id} onChange={handleCambio} className="campo-formulario">
                    <option value="">Selecciona un inquilino</option>
                    {inquilinos.map((i) => <option key={i.id} value={i.id}>{i.nombre}{i.nombre_inmueble ? ` — ${i.nombre_inmueble}` : ''}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="etiqueta-formulario">Dirección del bien asegurado</label>
                  <input name="direccion_bien_asegurado" value={formulario.direccion_bien_asegurado} onChange={handleCambio} className="campo-formulario" placeholder="Calle, número, ciudad..." />
                </div>
                <div>
                  <label className="etiqueta-formulario">Tipo de seguro</label>
                  <select name="tipo" value={formulario.tipo} onChange={handleCambio} className="campo-formulario text-sm py-1.5">
                    {TIPOS_POLIZA.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
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
                  <input type="number" step="0.01" min="0" name="importe_anual" value={formulario.importe_anual} onChange={handleCambio} className="campo-formulario" placeholder="0.00" />
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
                  <label className="etiqueta-formulario">Tomador de la póliza</label>
                  <input name="tomador_poliza" value={formulario.tomador_poliza} onChange={handleCambio} className="campo-formulario" placeholder="Nombre del tomador..." />
                </div>
              </div>
            </div>

            {/* Contacto compañía */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contacto de la compañía</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="etiqueta-formulario">Nombre contacto</label>
                  <input name="contacto_nombre" value={formulario.contacto_nombre} onChange={handleCambio} className="campo-formulario" placeholder="Nombre del agente" />
                </div>
                <div>
                  <label className="etiqueta-formulario">Teléfono</label>
                  <input name="contacto_telefono" value={formulario.contacto_telefono} onChange={handleCambio} className="campo-formulario" placeholder="600 000 000" />
                </div>
                <div>
                  <label className="etiqueta-formulario">Email</label>
                  <input type="email" name="contacto_email" value={formulario.contacto_email} onChange={handleCambio} className="campo-formulario" placeholder="agente@compania.com" />
                </div>
              </div>
            </div>

            {/* Análisis IA */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles size={13} /> Análisis IA
                {editando && formulario.documento_url && (
                  <button
                    type="button"
                    onClick={handleAnalizarEnFormulario}
                    disabled={analizandoForm}
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {analizandoForm ? (
                      <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600" /> Analizando...</>
                    ) : (
                      <><Sparkles size={12} /> Analizar con IA</>
                    )}
                  </button>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="etiqueta-formulario">Riesgos cubiertos</label>
                  <textarea name="riesgos_cubiertos" value={formulario.riesgos_cubiertos} onChange={handleCambio} rows={3} className="campo-formulario resize-none" placeholder="Coberturas incluidas en la póliza..." />
                </div>
                <div>
                  <label className="etiqueta-formulario">Riesgos no cubiertos</label>
                  <textarea name="riesgos_no_cubiertos" value={formulario.riesgos_no_cubiertos} onChange={handleCambio} rows={3} className="campo-formulario resize-none" placeholder="Exclusiones y riesgos no cubiertos..." />
                </div>
                <div>
                  <label className="etiqueta-formulario">Fortalezas</label>
                  <textarea name="analisis_fortalezas" value={formulario.analisis_fortalezas} onChange={handleCambio} rows={3} className="campo-formulario resize-none" placeholder="Puntos fuertes de la póliza..." />
                </div>
                <div>
                  <label className="etiqueta-formulario">Carencias</label>
                  <textarea name="analisis_carencias" value={formulario.analisis_carencias} onChange={handleCambio} rows={3} className="campo-formulario resize-none" placeholder="Aspectos mejorables o carencias..." />
                </div>
                <div className="col-span-2">
                  <label className="etiqueta-formulario">Cómo complementarla</label>
                  <textarea name="como_complementar" value={formulario.como_complementar} onChange={handleCambio} rows={2} className="campo-formulario resize-none" placeholder="Recomendaciones para mejorar la cobertura..." />
                </div>
                {editando?.comparador_mercado && (
                  <div className="col-span-2">
                    <label className="etiqueta-formulario">Comparador de mercado</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                      {editando.comparador_mercado.precio_estimado_mercado && (
                        <p><span className="font-medium text-gray-600">Precio mercado:</span> <span className="text-gray-700">{editando.comparador_mercado.precio_estimado_mercado}</span></p>
                      )}
                      {editando.comparador_mercado.evaluacion_precio && (
                        <p><span className="font-medium text-gray-600">Evaluación:</span> <span className="text-gray-700">{editando.comparador_mercado.evaluacion_precio}</span></p>
                      )}
                      {editando.comparador_mercado.recomendaciones && (
                        <p><span className="font-medium text-gray-600">Recomendaciones:</span> <span className="text-gray-700">{editando.comparador_mercado.recomendaciones}</span></p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Documento y notas */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="etiqueta-formulario">Documento PDF</label>
                <UploadPDF urlActual={formulario.documento_url} onSubida={(url) => setFormulario((p) => ({ ...p, documento_url: url }))} />
              </div>
              <div>
                <label className="etiqueta-formulario">Notas</label>
                <textarea name="notas" value={formulario.notas} onChange={handleCambio} rows={2} className="campo-formulario resize-none" placeholder="Observaciones..." />
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
        )}
      </Modal>

      {/* Modal análisis experto IA */}
      <Modal
        abierto={modalAnalisis}
        onCerrar={() => { setModalAnalisis(false); setPolizaAnalisis(null); setAnalisisActual(null); }}
        titulo={`Análisis experto IA — ${polizaAnalisis?.numero_poliza || polizaAnalisis?.compania_aseguradora || ''}`}
        ancho="max-w-2xl"
      >
        {polizaAnalisis && (
          <div className="space-y-4">
            {!polizaAnalisis.documento_url ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                  <FileText size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium mb-1">Sin documento PDF</p>
                <p className="text-sm text-gray-400">Sube el PDF de la póliza primero para poder realizar el análisis experto.</p>
              </div>
            ) : analizando ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
                <p className="text-gray-700 font-medium">Analizando con IA experta...</p>
                <p className="text-sm text-gray-400 mt-1">Esto puede tardar hasta 2 minutos. Por favor espera.</p>
              </div>
            ) : analisisActual ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">Valoración:</span>
                    <span className={`text-lg font-bold px-3 py-1 rounded-full ${
                      analisisActual.valoracion >= 7 ? 'bg-green-100 text-green-700' :
                      analisisActual.valoracion >= 5 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {analisisActual.valoracion}/10
                    </span>
                  </div>
                  {analisisActual.fecha_ultimo_analisis && (
                    <span className="text-xs text-gray-400">
                      {new Date(analisisActual.fecha_ultimo_analisis).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
                {analisisActual.riesgos_cubiertos && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Riesgos cubiertos</h4>
                    <p className="text-sm text-gray-700">{analisisActual.riesgos_cubiertos}</p>
                  </div>
                )}
                {analisisActual.riesgos_no_cubiertos && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Riesgos no cubiertos</h4>
                    <p className="text-sm text-gray-700">{analisisActual.riesgos_no_cubiertos}</p>
                  </div>
                )}
                {analisisActual.analisis_fortalezas && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Fortalezas</h4>
                    <p className="text-sm text-gray-700">{analisisActual.analisis_fortalezas}</p>
                  </div>
                )}
                {analisisActual.analisis_carencias && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">Carencias</h4>
                    <p className="text-sm text-gray-700">{analisisActual.analisis_carencias}</p>
                  </div>
                )}
                {analisisActual.como_complementar && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">Cómo complementar</h4>
                    <p className="text-sm text-gray-700">{analisisActual.como_complementar}</p>
                  </div>
                )}
                {analisisActual.comparador_mercado && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Comparador de mercado</h4>
                    <div className="space-y-2 text-sm">
                      {analisisActual.comparador_mercado.precio_estimado_mercado && (
                        <div><span className="text-gray-500 font-medium">Precio mercado:</span> <span className="text-gray-700">{analisisActual.comparador_mercado.precio_estimado_mercado}</span></div>
                      )}
                      {analisisActual.comparador_mercado.evaluacion_precio && (
                        <div><span className="text-gray-500 font-medium">Evaluación:</span> <span className="text-gray-700">{analisisActual.comparador_mercado.evaluacion_precio}</span></div>
                      )}
                      {analisisActual.comparador_mercado.recomendaciones && (
                        <div><span className="text-gray-500 font-medium">Recomendaciones:</span> <span className="text-gray-700">{analisisActual.comparador_mercado.recomendaciones}</span></div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <button
                    onClick={() => imprimirInformePoliza(analisisActual, polizaAnalisis)}
                    className="btn-secundario flex items-center gap-2"
                  >
                    <Download size={14} />
                    Descargar informe
                  </button>
                  <button onClick={handleAnalizarExperto} disabled={analizando} className="btn-secundario flex items-center gap-2">
                    <RefreshCw size={14} />
                    Regenerar análisis
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
                  <Sparkles size={24} className="text-purple-400" />
                </div>
                <p className="text-gray-600 font-medium mb-1">Sin análisis previo</p>
                <p className="text-sm text-gray-400 mb-6">Genera un análisis experto IA de esta póliza para obtener valoración, cobertura y comparativa de mercado.</p>
                <button onClick={handleAnalizarExperto} disabled={analizando} className="btn-primario">
                  <Sparkles size={16} />
                  Analizar con IA
                </button>
              </div>
            )}
          </div>
        )}
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

      {/* Modal comparador de pólizas */}
      <ModalComparador
        abierto={!!resultadoComparacion}
        onCerrar={() => setResultadoComparacion(null)}
        onDescargar={() => { setResultadoComparacion(null); setModoComparar(false); setSeleccionadas([]); }}
        datos={resultadoComparacion}
        tipo="inquilinos"
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  );
}
