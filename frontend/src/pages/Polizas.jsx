import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, FileText, RefreshCw, ClipboardList, ShieldAlert, Sparkles, Download, Scale, ArrowLeftRight, Shield, AlertTriangle, Eye, Home, Calendar, Euro, X, CheckCircle } from 'lucide-react';
import { imprimirInformePoliza } from '../utils/imprimirInforme.js';
import { formatearMiles, limpiarMiles } from '../utils/moneda.js';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import ModalComparador from '../components/ModalComparador.jsx';
import UploadPDF from '../components/UploadPDF.jsx';
import AnalizadorPDF from '../components/AnalizadorPDF.jsx';
import Toast from '../components/Toast.jsx';
import {
  obtenerPolizasApi, crearPolizaApi, actualizarPolizaApi, eliminarPolizaApi,
  obtenerInmueblesApi, renovarPolizaApi, obtenerHistorialApi, analizarExpertoPolizaApi,
  compararPolizasApi, compararRenovacionApi, analizarPdfApi,
} from '../api/index.js';

const TIPOS_POLIZA = [
  { valor: 'vivienda', etiqueta: 'Vivienda' },
  { valor: 'nave', etiqueta: 'Nave' },
  { valor: 'local', etiqueta: 'Local' },
  { valor: 'local_negocio', etiqueta: 'Local de Negocio' },
  { valor: 'inquilino_resp_civil', etiqueta: 'Inquilino Resp. Civil' },
  { valor: 'activ_economica', etiqueta: 'Activ. Económica' },
  { valor: 'comunidad', etiqueta: 'Comunidad' },
  { valor: 'otros', etiqueta: 'Otros' },
];

const API_BASE = import.meta.env.VITE_API_URL || '';
function urlDoc(url) {
  if (!url) return url;
  return url.startsWith('/') ? API_BASE + url : url;
}

const PERIODICIDADES = [
  { valor: 'anual', etiqueta: 'Anual' },
  { valor: 'semestral', etiqueta: 'Semestral' },
  { valor: 'trimestral', etiqueta: 'Trimestral' },
];

const formularioVacio = {
  inmueble_id: '', tipo: 'vivienda', compania_aseguradora: '', numero_poliza: '',
  fecha_inicio: '', fecha_vencimiento: '', importe_anual: '', notas: '', documento_url: '',
  tomador_poliza: '',
  contacto_nombre: '', contacto_telefono: '', contacto_email: '',
  periodicidad_pago: 'anual', importe_pago: '', fecha_proximo_pago: '',
  observaciones_ia: '',
  riesgos_cubiertos: '', riesgos_no_cubiertos: '',
  analisis_fortalezas: '', analisis_carencias: '',
  como_complementar: '',
  direccion_bien_asegurado: '',
  // Capitales asegurados (€)
  capital_continente: '', capital_contenido: '', capital_rc_general: '', capital_defensa_juridica: '',
  capital_danos_agua: '', capital_robo: '', capital_danos_electricos: '',
  capital_fenomenos_atmosfericos: '', capital_perdida_alquileres: '', capital_rc_propietario: '',
  // Coberturas NO contratadas
  cob_no_perdida_explotacion: false, cob_no_averia_maquinaria: false, cob_no_rc_productos: false,
  cob_no_todo_riesgo: false, cob_no_danos_esteticos: false, cob_no_rotura_cristales: false, cob_no_transporte: false,
  // Franquicias
  franquicias: '',
  // Datos del tomador
  tomador_cif_nif: '', tomador_telefono: '', tomador_email: '', tomador_banco_domiciliacion: '',
};

const CAPITALES_ASEGURADOS_INMUEBLE = [
  { key: 'capital_continente', label: 'Continente asegurado' },
  { key: 'capital_contenido', label: 'Contenido asegurado' },
  { key: 'capital_rc_general', label: 'RC General / Explotación' },
  { key: 'capital_defensa_juridica', label: 'Defensa jurídica' },
  { key: 'capital_danos_agua', label: 'Daños por agua' },
  { key: 'capital_robo', label: 'Robo' },
  { key: 'capital_danos_electricos', label: 'Daños eléctricos' },
  { key: 'capital_fenomenos_atmosfericos', label: 'Fenómenos atmosféricos' },
  { key: 'capital_perdida_alquileres', label: 'Pérdida de alquileres' },
  { key: 'capital_rc_propietario', label: 'RC propietario' },
];

const COBERTURAS_NO_CONTRATADAS_INMUEBLE = [
  { key: 'cob_no_perdida_explotacion', label: 'Pérdida de explotación' },
  { key: 'cob_no_averia_maquinaria', label: 'Avería de maquinaria' },
  { key: 'cob_no_rc_productos', label: 'RC de productos' },
  { key: 'cob_no_todo_riesgo', label: 'Todo riesgo accidental' },
  { key: 'cob_no_danos_esteticos', label: 'Daños estéticos' },
  { key: 'cob_no_rotura_cristales', label: 'Rotura de cristales' },
  { key: 'cob_no_transporte', label: 'Transporte' },
];

const renovarVacio = {
  nueva_fecha_inicio: '', nueva_fecha_vencimiento: '', nuevo_importe: '',
  nuevo_importe_pago: '', nueva_fecha_proximo_pago: '', notas: '',
  nueva_compania_aseguradora: '', nuevo_numero_poliza: '',
  nueva_periodicidad_pago: '', nuevo_contacto_nombre: '', nuevo_contacto_telefono: '',
  nuevo_contacto_email: '', nuevo_documento_url: '',
};

function calcularEstado(fechaVencimiento, tipoInmueble) {
  if (!fechaVencimiento) return { etiqueta: 'Sin fecha', clase: 'bg-gray-100 text-gray-600' };
  const dias = Math.ceil((new Date(fechaVencimiento) - new Date()) / 86400000);
  const umbral = 30;
  if (dias < 0) return { etiqueta: 'Vencida', clase: 'bg-red-100 text-red-700' };
  if (dias <= umbral) return { etiqueta: `Vence en ${dias}d`, clase: 'bg-orange-100 text-orange-700' };
  return { etiqueta: 'Vigente', clase: 'bg-green-100 text-green-700' };
}

function etiquetaTipo(valor) {
  return TIPOS_POLIZA.find((t) => t.valor === valor)?.etiqueta || valor;
}

export default function Polizas() {
  const navigate = useNavigate();
  const [polizas, setPolizas] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroInmueble, setFiltroInmueble] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pasoModal, setPasoModal] = useState('pdf'); // 'pdf' | 'form'
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);
  const [toast, setToast] = useState(null);

  // Renovación
  const [modalRenovar, setModalRenovar] = useState(false);
  const [polizaRenovando, setPolizaRenovando] = useState(null);
  const [pasoRenovar, setPasoRenovar] = useState('eleccion'); // 'eleccion' | 'pdf' | 'analizando' | 'form' | 'comparacion' | 'confirmar'
  const [tipoRenovacion, setTipoRenovacion] = useState('misma'); // 'misma' | 'nueva'
  const [renovarForm, setRenovarForm] = useState(renovarVacio);
  const [guardandoRenovacion, setGuardandoRenovacion] = useState(false);
  const renovarPdfInputRef = useRef(null);
  const [renovacionPdfFile, setRenovacionPdfFile] = useState(null);
  const [renovacionErrorPdf, setRenovacionErrorPdf] = useState('');
  const [renovacionComparacion, setRenovacionComparacion] = useState(null);
  const [renovacionComparando, setRenovacionComparando] = useState(false);

  // Análisis experto IA (modal desde tabla)
  const [modalAnalisis, setModalAnalisis] = useState(false);
  const [polizaAnalisis, setPolizaAnalisis] = useState(null);
  const [analisisActual, setAnalisisActual] = useState(null);
  const [analizando, setAnalizando] = useState(false);

  // Análisis experto IA (desde el formulario)
  const [analizandoForm, setAnalizandoForm] = useState(false);

  // Confirmación post-descarga (dentro del modal de análisis)
  const [informeDescargado, setInformeDescargado] = useState(false);

  // Comparador de pólizas con IA
  const [modoComparar, setModoComparar] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [comparando, setComparando] = useState(false);
  const [resultadoComparacion, setResultadoComparacion] = useState(null);

  // Comparador de renovación
  const [modoRenovacion, setModoRenovacion] = useState(false);
  const [renovacionPolizaId, setRenovacionPolizaId] = useState(null);
  const [renovacionArchivo, setRenovacionArchivo] = useState(null);
  const [comparandoRenovacion, setComparandoRenovacion] = useState(false);
  const [resultadoRenovacion, setResultadoRenovacion] = useState(null);

  // Modal Ficha (visualización)
  const [modalFicha, setModalFicha] = useState(false);
  const [polizaFicha, setPolizaFicha] = useState(null);

  // Historial
  const [modalHistorial, setModalHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [polizaHistorial, setPolizaHistorial] = useState(null);

  async function cargar() {
    try {
      const [resP, resI] = await Promise.all([
        obtenerPolizasApi({ inmueble_id: filtroInmueble || undefined, tipo: filtroTipo || undefined }),
        obtenerInmueblesApi(),
      ]);
      setPolizas(resP.data);
      setInmuebles(resI.data);
    } catch {
      setToast({ mensaje: 'Error al cargar los datos', tipo: 'error' });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroInmueble, filtroTipo]);

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
      inmueble_id: poliza.inmueble_id || '',
      tipo: poliza.tipo || 'vivienda',
      compania_aseguradora: poliza.compania_aseguradora || '',
      numero_poliza: poliza.numero_poliza || '',
      fecha_inicio: poliza.fecha_inicio?.split('T')[0] || '',
      fecha_vencimiento: poliza.fecha_vencimiento?.split('T')[0] || '',
      importe_anual: poliza.importe_anual || '',
      notas: poliza.notas || '',
      documento_url: poliza.documento_url || '',
      contacto_nombre: poliza.contacto_nombre || '',
      contacto_telefono: poliza.contacto_telefono || '',
      contacto_email: poliza.contacto_email || '',
      periodicidad_pago: poliza.periodicidad_pago || 'anual',
      importe_pago: poliza.importe_pago || '',
      fecha_proximo_pago: poliza.fecha_proximo_pago?.split('T')[0] || '',
      tomador_poliza: poliza.tomador_poliza || '',
      observaciones_ia: '',
      riesgos_cubiertos: poliza.riesgos_cubiertos || '',
      riesgos_no_cubiertos: poliza.riesgos_no_cubiertos || '',
      analisis_fortalezas: poliza.analisis_fortalezas || '',
      analisis_carencias: poliza.analisis_carencias || '',
      como_complementar: poliza.como_complementar || '',
      direccion_bien_asegurado: poliza.direccion_bien_asegurado || '',
      capital_continente: poliza.capital_continente != null ? String(poliza.capital_continente) : '',
      capital_contenido: poliza.capital_contenido != null ? String(poliza.capital_contenido) : '',
      capital_rc_general: poliza.capital_rc_general != null ? String(poliza.capital_rc_general) : '',
      capital_defensa_juridica: poliza.capital_defensa_juridica != null ? String(poliza.capital_defensa_juridica) : '',
      capital_danos_agua: poliza.capital_danos_agua != null ? String(poliza.capital_danos_agua) : '',
      capital_robo: poliza.capital_robo != null ? String(poliza.capital_robo) : '',
      capital_danos_electricos: poliza.capital_danos_electricos != null ? String(poliza.capital_danos_electricos) : '',
      capital_fenomenos_atmosfericos: poliza.capital_fenomenos_atmosfericos != null ? String(poliza.capital_fenomenos_atmosfericos) : '',
      capital_perdida_alquileres: poliza.capital_perdida_alquileres != null ? String(poliza.capital_perdida_alquileres) : '',
      capital_rc_propietario: poliza.capital_rc_propietario != null ? String(poliza.capital_rc_propietario) : '',
      cob_no_perdida_explotacion: !!poliza.cob_no_perdida_explotacion,
      cob_no_averia_maquinaria: !!poliza.cob_no_averia_maquinaria,
      cob_no_rc_productos: !!poliza.cob_no_rc_productos,
      cob_no_todo_riesgo: !!poliza.cob_no_todo_riesgo,
      cob_no_danos_esteticos: !!poliza.cob_no_danos_esteticos,
      cob_no_rotura_cristales: !!poliza.cob_no_rotura_cristales,
      cob_no_transporte: !!poliza.cob_no_transporte,
      franquicias: poliza.franquicias || '',
      tomador_cif_nif: poliza.tomador_cif_nif || '',
      tomador_telefono: poliza.tomador_telefono || '',
      tomador_email: poliza.tomador_email || '',
      tomador_banco_domiciliacion: poliza.tomador_banco_domiciliacion || '',
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
      importe_pago: datos.importe_pago != null ? String(datos.importe_pago) : prev.importe_pago,
      periodicidad_pago: datos.periodicidad_pago || prev.periodicidad_pago,
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
      // Capitales asegurados
      capital_continente: datos.capital_continente != null ? String(datos.capital_continente) : prev.capital_continente,
      capital_contenido: datos.capital_contenido != null ? String(datos.capital_contenido) : prev.capital_contenido,
      capital_rc_general: datos.capital_rc_general != null ? String(datos.capital_rc_general) : prev.capital_rc_general,
      capital_defensa_juridica: datos.capital_defensa_juridica != null ? String(datos.capital_defensa_juridica) : prev.capital_defensa_juridica,
      capital_danos_agua: datos.capital_danos_agua != null ? String(datos.capital_danos_agua) : prev.capital_danos_agua,
      capital_robo: datos.capital_robo != null ? String(datos.capital_robo) : prev.capital_robo,
      capital_danos_electricos: datos.capital_danos_electricos != null ? String(datos.capital_danos_electricos) : prev.capital_danos_electricos,
      capital_fenomenos_atmosfericos: datos.capital_fenomenos_atmosfericos != null ? String(datos.capital_fenomenos_atmosfericos) : prev.capital_fenomenos_atmosfericos,
      capital_perdida_alquileres: datos.capital_perdida_alquileres != null ? String(datos.capital_perdida_alquileres) : prev.capital_perdida_alquileres,
      capital_rc_propietario: datos.capital_rc_propietario != null ? String(datos.capital_rc_propietario) : prev.capital_rc_propietario,
      // Coberturas NO contratadas
      cob_no_perdida_explotacion: datos.cob_no_perdida_explotacion === true ? true : prev.cob_no_perdida_explotacion,
      cob_no_averia_maquinaria: datos.cob_no_averia_maquinaria === true ? true : prev.cob_no_averia_maquinaria,
      cob_no_rc_productos: datos.cob_no_rc_productos === true ? true : prev.cob_no_rc_productos,
      cob_no_todo_riesgo: datos.cob_no_todo_riesgo === true ? true : prev.cob_no_todo_riesgo,
      cob_no_danos_esteticos: datos.cob_no_danos_esteticos === true ? true : prev.cob_no_danos_esteticos,
      cob_no_rotura_cristales: datos.cob_no_rotura_cristales === true ? true : prev.cob_no_rotura_cristales,
      cob_no_transporte: datos.cob_no_transporte === true ? true : prev.cob_no_transporte,
      franquicias: datos.franquicias || prev.franquicias,
      tomador_cif_nif: datos.tomador_cif_nif || prev.tomador_cif_nif,
      tomador_telefono: datos.tomador_telefono || prev.tomador_telefono,
      tomador_email: datos.tomador_email || prev.tomador_email,
      tomador_banco_domiciliacion: datos.tomador_banco_domiciliacion || prev.tomador_banco_domiciliacion,
    }));
    setPasoModal('form');
  }

  function handleCambio(e) {
    setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!formulario.inmueble_id) { setToast({ mensaje: 'Debes seleccionar un inmueble antes de guardar la póliza', tipo: 'error' }); return; }
    setGuardando(true);
    setError('');
    try {
      const toFloat = (v) => (v !== '' && v != null ? parseFloat(v) : null);
      const datos = {
        ...formulario,
        importe_anual: toFloat(formulario.importe_anual),
        importe_pago: toFloat(formulario.importe_pago),
        capital_continente: toFloat(formulario.capital_continente),
        capital_contenido: toFloat(formulario.capital_contenido),
        capital_rc_general: toFloat(formulario.capital_rc_general),
        capital_defensa_juridica: toFloat(formulario.capital_defensa_juridica),
        capital_danos_agua: toFloat(formulario.capital_danos_agua),
        capital_robo: toFloat(formulario.capital_robo),
        capital_danos_electricos: toFloat(formulario.capital_danos_electricos),
        capital_fenomenos_atmosfericos: toFloat(formulario.capital_fenomenos_atmosfericos),
        capital_perdida_alquileres: toFloat(formulario.capital_perdida_alquileres),
        capital_rc_propietario: toFloat(formulario.capital_rc_propietario),
      };
      if (editando) {
        await actualizarPolizaApi(editando.id, datos);
        setToast({ mensaje: 'Póliza actualizada correctamente', tipo: 'success' });
      } else {
        await crearPolizaApi(datos);
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
      await eliminarPolizaApi(id);
      setConfirmandoEliminar(null);
      setToast({ mensaje: 'Póliza eliminada correctamente', tipo: 'success' });
      await cargar();
      window.dispatchEvent(new CustomEvent('refreshBadges'));
    } catch (err) {
      setToast({ mensaje: err.response?.data?.error || 'Error al eliminar la póliza', tipo: 'error' });
    }
  }

  // --- Renovación ---
  function abrirRenovar(poliza) {
    setPolizaRenovando(poliza);
    setRenovarForm({
      ...renovarVacio,
      nueva_fecha_inicio: poliza.fecha_vencimiento?.split('T')[0] || '',
    });
    setPasoRenovar('eleccion');
    setTipoRenovacion('misma');
    setRenovacionPdfFile(null);
    setRenovacionErrorPdf('');
    setRenovacionComparacion(null);
    setRenovacionComparando(false);
    setError('');
    setModalRenovar(true);
  }

  function elegirTipoRenovacion(tipo) {
    setTipoRenovacion(tipo);
    if (tipo === 'misma') {
      setRenovarForm((prev) => ({
        ...prev,
        nueva_compania_aseguradora: '',
        nuevo_numero_poliza: '',
      }));
    }
    setPasoRenovar('pdf');
  }

  async function handleRenovacionPdf(archivo) {
    if (!archivo) return;
    if (archivo.type !== 'application/pdf') {
      setRenovacionErrorPdf('Solo se permiten archivos PDF');
      return;
    }
    if (archivo.size > 20 * 1024 * 1024) {
      setRenovacionErrorPdf('El archivo no puede superar los 20 MB');
      return;
    }
    setRenovacionErrorPdf('');
    setRenovacionPdfFile(archivo);
    setPasoRenovar('analizando');
    try {
      const res = await analizarPdfApi(archivo);
      const datos = res.data?.datos || res.data;
      const documentoUrl = res.data?.documento_url || datos?.documento_url || '';
      setRenovarForm((prev) => ({
        ...prev,
        nueva_compania_aseguradora: datos.compania_aseguradora || prev.nueva_compania_aseguradora,
        nuevo_numero_poliza: datos.numero_poliza || prev.nuevo_numero_poliza,
        nueva_fecha_inicio: datos.fecha_inicio || prev.nueva_fecha_inicio,
        nueva_fecha_vencimiento: datos.fecha_vencimiento || prev.nueva_fecha_vencimiento,
        nuevo_importe: datos.importe_anual != null ? String(datos.importe_anual) : prev.nuevo_importe,
        nuevo_importe_pago: datos.importe_pago != null ? String(datos.importe_pago) : prev.nuevo_importe_pago,
        nueva_periodicidad_pago: datos.periodicidad_pago || prev.nueva_periodicidad_pago,
        nueva_fecha_proximo_pago: datos.fecha_proximo_pago || prev.nueva_fecha_proximo_pago,
        nuevo_contacto_nombre: datos.contacto_nombre || prev.nuevo_contacto_nombre,
        nuevo_contacto_telefono: datos.contacto_telefono || prev.nuevo_contacto_telefono,
        nuevo_contacto_email: datos.contacto_email || prev.nuevo_contacto_email,
        nuevo_documento_url: documentoUrl || prev.nuevo_documento_url,
      }));
      setPasoRenovar('form');
    } catch (err) {
      setRenovacionErrorPdf(err.response?.data?.error || 'Error al analizar el PDF');
      setPasoRenovar('pdf');
    }
  }

  function handleRenovarFormSubmit(e) {
    e.preventDefault();
    if (!renovarForm.nueva_fecha_vencimiento) {
      setError('La nueva fecha de vencimiento es requerida');
      return;
    }
    // Si hay PDF antiguo y nuevo → comparar
    if (polizaRenovando?.documento_url && renovacionPdfFile) {
      setPasoRenovar('comparacion');
      iniciarComparacion();
    } else {
      setPasoRenovar('confirmar');
    }
  }

  async function iniciarComparacion() {
    setRenovacionComparando(true);
    setRenovacionComparacion(null);
    try {
      const res = await compararRenovacionApi(polizaRenovando.id, renovacionPdfFile);
      setRenovacionComparacion(res.data);
    } catch {
      setRenovacionComparacion({ error: true });
    } finally {
      setRenovacionComparando(false);
    }
  }

  async function handleConfirmarRenovacion() {
    setGuardandoRenovacion(true);
    setError('');
    try {
      await renovarPolizaApi(polizaRenovando.id, {
        ...renovarForm,
        nuevo_importe: renovarForm.nuevo_importe ? parseFloat(renovarForm.nuevo_importe) : null,
        nuevo_importe_pago: renovarForm.nuevo_importe_pago ? parseFloat(renovarForm.nuevo_importe_pago) : null,
      });
      setModalRenovar(false);
      setToast({ mensaje: 'Póliza renovada correctamente', tipo: 'success' });
      await cargar();
      window.dispatchEvent(new CustomEvent('refreshBadges'));
    } catch (err) {
      setError(err.response?.data?.error || 'Error al renovar la póliza');
    } finally {
      setGuardandoRenovacion(false);
    }
  }

  // --- Historial ---
  async function abrirHistorial(poliza) {
    setPolizaHistorial(poliza);
    setModalHistorial(true);
    setCargandoHistorial(true);
    try {
      const res = await obtenerHistorialApi(poliza.id);
      setHistorial(res.data);
    } catch {
      setHistorial([]);
    } finally {
      setCargandoHistorial(false);
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
      const res = await analizarExpertoPolizaApi(polizaAnalisis.id);
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
      const res = await analizarExpertoPolizaApi(editando.id);
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
      const res = await compararPolizasApi(seleccionadas, 'inmuebles');
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

  async function handleCompararRenovacion() {
    if (!renovacionPolizaId || !renovacionArchivo) return;
    setComparandoRenovacion(true);
    try {
      const res = await compararRenovacionApi(renovacionPolizaId, renovacionArchivo);
      setResultadoRenovacion(res.data);
    } catch (err) {
      setToast({ mensaje: err.response?.data?.error || 'Error al comparar la renovación', tipo: 'error' });
    } finally {
      setComparandoRenovacion(false);
    }
  }

  const columnas = [
    {
      clave: 'nombre_inmueble', titulo: 'Inmueble', sortable: true,
      valorOrden: (f) => f.nombre_inmueble || '',
      render: (f) => <span className="font-medium">{f.nombre_inmueble || '—'}</span>,
    },
    { clave: 'tipo', titulo: 'Tipo', sortable: true, render: (f) => etiquetaTipo(f.tipo) },
    {
      clave: 'compania_aseguradora', titulo: 'Compañía', sortable: true,
      valorOrden: (f) => f.compania_aseguradora || '',
    },
    {
      clave: 'tomador_poliza', titulo: 'Tomador',
      render: (f) => f.tomador_poliza || '—',
    },
    {
      clave: 'numero_poliza', titulo: 'Nº Póliza',
      render: (f) => <span className="font-mono text-sm">{f.numero_poliza || '—'}</span>,
    },
    {
      clave: 'fecha_vencimiento', titulo: 'Vencimiento', sortable: true,
      valorOrden: (f) => f.fecha_vencimiento || '9999-12-31',
      render: (f) => f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES') : '—',
    },
    {
      clave: 'importe_anual', titulo: 'Importe/año',
      render: (f) => f.importe_anual ? `${formatearMiles(parseFloat(f.importe_anual).toFixed(2))} €` : '—',
    },
    {
      clave: 'estado', titulo: 'Estado', sortable: true,
      valorOrden: (f) => f.fecha_vencimiento || '9999-12-31',
      render: (f) => {
        const est = calcularEstado(f.fecha_vencimiento, f.tipo_inmueble);
        return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${est.clase}`}>{est.etiqueta}</span>;
      },
    },
    {
      clave: 'documento_url', titulo: 'Doc.',
      render: (f) => f.documento_url ? (
        <a href={urlDoc(f.documento_url)} target="_blank" rel="noopener noreferrer" title="Ver documento PDF" className="inline-flex p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
          <FileText size={20} />
        </a>
      ) : '—',
    },
    {
      clave: 'acciones', titulo: 'Acciones', ancho: '210px',
      render: (f) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setPolizaFicha(f); setModalFicha(true); }} title="Ver ficha" className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors">
            <Eye size={20} />
          </button>
          <button onClick={() => abrirEditar(f)} title="Editar" className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
            <Pencil size={20} />
          </button>
          <button onClick={() => abrirRenovar(f)} title="Renovar póliza" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <RefreshCw size={20} />
          </button>
          <button onClick={() => abrirHistorial(f)} title="Ver historial de renovaciones" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <ClipboardList size={20} />
          </button>
          <button onClick={() => navigate(`/siniestros?poliza_id=${f.id}`)} title="Ver siniestros" className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
            <ShieldAlert size={20} />
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

  const CampoRenovar = ({ name, label, type = 'text', placeholder, moneda }) => (
    <div>
      <label className="etiqueta-formulario">{label}</label>
      <input
        type={moneda ? 'text' : type}
        inputMode={moneda ? 'decimal' : undefined}
        name={name}
        value={moneda ? formatearMiles(renovarForm[name]) : renovarForm[name]}
        onChange={(e) => setRenovarForm((p) => ({ ...p, [e.target.name]: moneda ? limpiarMiles(e.target.value) : e.target.value }))}
        className="campo-formulario"
        placeholder={placeholder}
        step={!moneda && type === 'number' ? '0.01' : undefined}
        min={!moneda && type === 'number' ? '0' : undefined}
      />
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={24} className="text-[#1e3a5f]" />
            Pólizas de Inmuebles
          </h1>
          <p className="text-gray-500 text-sm mt-1">{polizas.length} pólizas registradas</p>
        </div>
        <button onClick={abrirCrear} className="btn-primario"><Plus size={16} /> Nueva póliza</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filtroInmueble} onChange={(e) => setFiltroInmueble(e.target.value)} className="campo-formulario w-full sm:w-auto sm:min-w-[180px]">
          <option value="">Todos los inmuebles</option>
          {inmuebles.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="campo-formulario w-full sm:w-auto sm:min-w-[160px]">
          <option value="">Todos los tipos</option>
          {TIPOS_POLIZA.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
        </select>
        <button
          onClick={() => { setModoComparar((v) => !v); setSeleccionadas([]); setModoRenovacion(false); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            modoComparar
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
          }`}
        >
          <Scale size={15} />
          Comparar pólizas
        </button>
        <button
          onClick={() => { setModoRenovacion((v) => !v); setRenovacionPolizaId(null); setRenovacionArchivo(null); setModoComparar(false); setSeleccionadas([]); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            modoRenovacion
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
          }`}
        >
          <ArrowLeftRight size={15} />
          Comparar renovación
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
                  {p.nombre_inmueble && <span className="text-gray-500 ml-2">· {p.nombre_inmueble}</span>}
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

      {/* Panel de selección para comparar renovación */}
      {modoRenovacion && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            Selecciona 1 póliza actual y sube el PDF de la renovación para comparar
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
            {polizas.map((p) => (
              <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100 cursor-pointer">
                <input
                  type="radio"
                  name="renovacion_poliza"
                  checked={renovacionPolizaId === p.id}
                  onChange={() => setRenovacionPolizaId(p.id)}
                  className="w-4 h-4 text-amber-600"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">{p.compania_aseguradora || 'Sin compañía'}</span>
                  {p.numero_poliza && <span className="text-gray-400 font-mono text-xs ml-2">· {p.numero_poliza}</span>}
                  {p.nombre_inmueble && <span className="text-gray-500 ml-2">· {p.nombre_inmueble}</span>}
                </span>
              </label>
            ))}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-amber-800 mb-1">PDF de la nueva póliza (renovación)</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setRenovacionArchivo(e.target.files[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
            />
            {renovacionArchivo && (
              <p className="text-xs text-amber-600 mt-1">{renovacionArchivo.name}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCompararRenovacion}
              disabled={!renovacionPolizaId || !renovacionArchivo || comparandoRenovacion}
              className="btn-primario disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {comparandoRenovacion ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Comparando...</>
              ) : (
                <><ArrowLeftRight size={15} /> Comparar con renovación</>
              )}
            </button>
            <button
              onClick={() => { setModoRenovacion(false); setRenovacionPolizaId(null); setRenovacionArchivo(null); }}
              className="btn-secundario"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <Tabla columnas={columnas} datos={polizas} cargando={cargando} mensajeVacio="No hay pólizas registradas." filasPorPagina={9999} />
      </div>

      {/* Modal alta/edición */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editando ? 'Editar póliza' : 'Nueva póliza'}
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
                  <label className="etiqueta-formulario">Inmueble *</label>
                  <select name="inmueble_id" value={formulario.inmueble_id} onChange={handleCambio} className="campo-formulario">
                    <option value="">Selecciona un inmueble</option>
                    {inmuebles.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
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
                  <input type="text" inputMode="decimal" name="importe_anual" value={formatearMiles(formulario.importe_anual)} onChange={(e) => handleCambio({ target: { name: 'importe_anual', value: limpiarMiles(e.target.value) } })} className="campo-formulario" placeholder="0,00" />
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

            {/* Pagos */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pagos y periodicidad</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="etiqueta-formulario">Periodicidad</label>
                  <select name="periodicidad_pago" value={formulario.periodicidad_pago} onChange={handleCambio} className="campo-formulario">
                    {PERIODICIDADES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                  </select>
                </div>
                <div>
                  <label className="etiqueta-formulario">Importe por pago (€)</label>
                  <input type="text" inputMode="decimal" name="importe_pago" value={formatearMiles(formulario.importe_pago)} onChange={(e) => handleCambio({ target: { name: 'importe_pago', value: limpiarMiles(e.target.value) } })} className="campo-formulario" placeholder="0,00" />
                </div>
                <div>
                  <label className="etiqueta-formulario">Próximo pago</label>
                  <input type="date" name="fecha_proximo_pago" value={formulario.fecha_proximo_pago} onChange={handleCambio} className="campo-formulario" />
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

            {/* Coberturas y capitales asegurados */}
            <div>
              <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield size={14} /> Coberturas y capitales asegurados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/40 border border-emerald-100 rounded-xl p-4">
                {CAPITALES_ASEGURADOS_INMUEBLE.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        name={key}
                        value={formatearMiles(formulario[key])}
                        onChange={(e) => setFormulario((p) => ({ ...p, [key]: limpiarMiles(e.target.value) }))}
                        className="campo-formulario pr-8 text-sm"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">€</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coberturas NO contratadas */}
            <div>
              <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle size={14} /> Coberturas NO contratadas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-red-50/40 border border-red-100 rounded-xl p-4">
                {COBERTURAS_NO_CONTRATADAS_INMUEBLE.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-red-100/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={!!formulario[key]}
                      onChange={(e) => setFormulario((p) => ({ ...p, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Franquicias */}
            <div>
              <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle size={14} /> Franquicias aplicables
              </h3>
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
                <textarea
                  name="franquicias"
                  value={formulario.franquicias}
                  onChange={handleCambio}
                  rows={3}
                  className="w-full bg-white/70 border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Ej: Robo 150 €, Daños por agua 90 €, Rotura de cristales sin franquicia..."
                />
              </div>
            </div>

            {/* Datos del tomador */}
            <div>
              <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield size={14} /> Datos del tomador
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Nombre del tomador</label>
                  <input name="tomador_poliza" value={formulario.tomador_poliza} onChange={handleCambio} className="campo-formulario text-sm" placeholder="Nombre completo o razón social" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CIF / NIF</label>
                  <input name="tomador_cif_nif" value={formulario.tomador_cif_nif} onChange={handleCambio} className="campo-formulario font-mono text-sm" placeholder="B12345678 / 12345678A" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                  <input name="tomador_telefono" value={formulario.tomador_telefono} onChange={handleCambio} className="campo-formulario text-sm" placeholder="600 000 000" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input type="email" name="tomador_email" value={formulario.tomador_email} onChange={handleCambio} className="campo-formulario text-sm" placeholder="tomador@email.com" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Banco domiciliación</label>
                  <input name="tomador_banco_domiciliacion" value={formulario.tomador_banco_domiciliacion} onChange={handleCambio} className="campo-formulario text-sm" placeholder="BBVA / ES00 0000 0000 ..." />
                </div>
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
        onCerrar={() => { setModalAnalisis(false); setPolizaAnalisis(null); setAnalisisActual(null); setInformeDescargado(false); }}
        titulo={`Análisis experto IA — ${polizaAnalisis?.numero_poliza || polizaAnalisis?.compania_aseguradora || ''}`}
        ancho="max-w-2xl"
      >
        {polizaAnalisis && informeDescargado ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center">
              <Download size={28} className="text-green-500" />
            </div>
            <p className="text-gray-800 font-semibold text-lg">Informe descargado</p>
            <p className="text-gray-500 text-sm">¿Quieres generar más informes?</p>
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => { setInformeDescargado(false); setModalAnalisis(false); setPolizaAnalisis(null); setAnalisisActual(null); }}
                className="btn-primario flex-1 justify-center"
              >
                Sí, seleccionar póliza
              </button>
              <button
                onClick={() => { setInformeDescargado(false); setModalAnalisis(false); setPolizaAnalisis(null); setAnalisisActual(null); navigate('/polizas'); }}
                className="btn-secundario flex-1 justify-center"
              >
                No, volver a pólizas
              </button>
            </div>
          </div>
        ) : polizaAnalisis && (
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
                    onClick={() => { imprimirInformePoliza(analisisActual, polizaAnalisis); setInformeDescargado(true); }}
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

      {/* Modal renovar */}
      <Modal
        abierto={modalRenovar}
        onCerrar={() => { setModalRenovar(false); setError(''); }}
        titulo={`Renovar póliza — ${polizaRenovando?.numero_poliza || ''}`}
        ancho="max-w-3xl"
      >
        {polizaRenovando && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
            <p><strong>Inmueble:</strong> {polizaRenovando.nombre_inmueble}</p>
            <p><strong>Compañía actual:</strong> {polizaRenovando.compania_aseguradora || '—'}</p>
            <p><strong>Vencimiento actual:</strong> {polizaRenovando.fecha_vencimiento ? new Date(polizaRenovando.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}</p>
            <p><strong>Importe actual:</strong> {polizaRenovando.importe_anual ? `${formatearMiles(parseFloat(polizaRenovando.importe_anual).toFixed(2))} €` : '—'}</p>
          </div>
        )}

        {/* Paso 1: Elección misma/nueva compañía */}
        {pasoRenovar === 'eleccion' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">¿Cómo se renueva esta póliza?</p>
            <button
              type="button"
              onClick={() => elegirTipoRenovacion('misma')}
              className="w-full text-left p-4 border-2 border-gray-200 hover:border-[#1e3a5f] rounded-xl transition-colors"
            >
              <p className="font-semibold text-gray-900">Misma compañía</p>
              <p className="text-sm text-gray-500 mt-1">Se mantiene la compañía y nº de póliza. Solo actualizar fechas e importes.</p>
            </button>
            <button
              type="button"
              onClick={() => elegirTipoRenovacion('nueva')}
              className="w-full text-left p-4 border-2 border-gray-200 hover:border-[#1e3a5f] rounded-xl transition-colors"
            >
              <p className="font-semibold text-gray-900">Compañía nueva</p>
              <p className="text-sm text-gray-500 mt-1">Se ha cambiado de compañía aseguradora. Actualizar todos los datos.</p>
            </button>
          </div>
        )}

        {/* Paso 2: PDF */}
        {pasoRenovar === 'pdf' && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <FileText size={28} className="text-blue-500" />
            </div>
            <p className="text-gray-800 font-semibold text-lg mb-1">¿Tienes la nueva póliza en PDF?</p>
            <p className="text-sm text-gray-400 mb-6">Analizaremos el documento con IA para pre-rellenar el formulario automáticamente.</p>
            <input
              ref={renovarPdfInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { if (e.target.files[0]) handleRenovacionPdf(e.target.files[0]); }}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => renovarPdfInputRef.current?.click()}
                className="btn-primario"
              >
                <FileText size={16} /> Sí, analizar PDF
              </button>
              <button
                type="button"
                onClick={() => setPasoRenovar('form')}
                className="btn-secundario"
              >
                Omitir
              </button>
            </div>
            {renovacionErrorPdf && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{renovacionErrorPdf}</div>
            )}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => { setPasoRenovar('eleccion'); setRenovacionErrorPdf(''); }} className="text-sm text-gray-400 hover:text-gray-600">
                ← Atrás
              </button>
            </div>
          </div>
        )}

        {/* Paso 2b: Analizando PDF */}
        {pasoRenovar === 'analizando' && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
            <p className="text-gray-700 font-medium">Analizando el PDF...</p>
            <p className="text-sm text-gray-400 mt-1">Extrayendo datos con IA. Esto puede tardar unos segundos.</p>
          </div>
        )}

        {/* Paso 3: Formulario */}
        {pasoRenovar === 'form' && (
          <form onSubmit={handleRenovarFormSubmit} className="space-y-5">
            {/* Datos póliza */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos de la póliza</h3>
              <div className="grid grid-cols-2 gap-4">
                <CampoRenovar name="nueva_compania_aseguradora" label={tipoRenovacion === 'nueva' ? 'Nueva compañía aseguradora' : 'Compañía aseguradora'} placeholder="Nombre de la compañía" />
                <CampoRenovar name="nuevo_numero_poliza" label={tipoRenovacion === 'nueva' ? 'Nuevo nº póliza' : 'Nº póliza'} placeholder="POL-2025-XXXX" />
              </div>
            </div>

            {/* Fechas */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Fechas</h3>
              <div className="grid grid-cols-2 gap-4">
                <CampoRenovar name="nueva_fecha_inicio" label="Fecha de inicio" type="date" />
                <CampoRenovar name="nueva_fecha_vencimiento" label="Fecha de vencimiento *" type="date" />
              </div>
            </div>

            {/* Importes */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Importes y pagos</h3>
              <div className="grid grid-cols-3 gap-4">
                <CampoRenovar name="nuevo_importe" label="Importe anual (€)" moneda placeholder="Dejar vacío = mantener" />
                <CampoRenovar name="nuevo_importe_pago" label="Importe por pago (€)" moneda placeholder="Dejar vacío = mantener" />
                <div>
                  <label className="etiqueta-formulario">Periodicidad</label>
                  <select
                    name="nueva_periodicidad_pago"
                    value={renovarForm.nueva_periodicidad_pago}
                    onChange={(e) => setRenovarForm((p) => ({ ...p, nueva_periodicidad_pago: e.target.value }))}
                    className="campo-formulario"
                  >
                    <option value="">Mantener actual</option>
                    {PERIODICIDADES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                  </select>
                </div>
                <CampoRenovar name="nueva_fecha_proximo_pago" label="Próximo pago" type="date" />
              </div>
            </div>

            {/* Contacto */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contacto de la compañía</h3>
              <div className="grid grid-cols-3 gap-4">
                <CampoRenovar name="nuevo_contacto_nombre" label="Nombre contacto" placeholder="Nombre del agente" />
                <CampoRenovar name="nuevo_contacto_telefono" label="Teléfono" placeholder="600 000 000" />
                <CampoRenovar name="nuevo_contacto_email" label="Email" placeholder="agente@compania.com" />
              </div>
            </div>

            {/* PDF (si omitió el paso anterior) */}
            {!renovacionPdfFile && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Documento PDF</h3>
                <UploadPDF urlActual={renovarForm.nuevo_documento_url} onSubida={(url) => setRenovarForm((p) => ({ ...p, nuevo_documento_url: url }))} />
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="etiqueta-formulario">Notas de renovación</label>
              <textarea
                value={renovarForm.notas}
                onChange={(e) => setRenovarForm((p) => ({ ...p, notas: e.target.value }))}
                rows={2} className="campo-formulario resize-none" placeholder="Observaciones sobre esta renovación..."
              />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setPasoRenovar('pdf'); setError(''); }} className="btn-secundario">Atrás</button>
              <button type="button" onClick={() => { setModalRenovar(false); setError(''); }} className="btn-secundario flex-1">Cancelar</button>
              <button type="submit" className="btn-primario flex-1 justify-center">Siguiente</button>
            </div>
          </form>
        )}

        {/* Paso 4: Comparación */}
        {pasoRenovar === 'comparacion' && (
          <div className="space-y-6">
            {renovacionComparando ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
                </div>
                <p className="text-gray-700 font-medium">Comparando pólizas con IA...</p>
                <p className="text-sm text-gray-400 mt-1">Analizando diferencias entre la póliza actual y la nueva. Puede tardar hasta 2 minutos.</p>
              </div>
            ) : renovacionComparacion?.error ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-lg">
                  No se pudo generar el informe comparativo. Puedes continuar igualmente con la renovación.
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setPasoRenovar('form'); setError(''); }} className="btn-secundario">Atrás</button>
                  <button type="button" onClick={() => { setModalRenovar(false); setError(''); }} className="btn-secundario flex-1">No renovar</button>
                  <button type="button" onClick={handleConfirmarRenovacion} disabled={guardandoRenovacion} className="btn-primario flex-1 justify-center">
                    {guardandoRenovacion ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Sí, renovar'}
                  </button>
                </div>
              </div>
            ) : renovacionComparacion ? (
              <div className="space-y-6">
                {/* Resumen ejecutivo */}
                {renovacionComparacion.resumen && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Resumen ejecutivo</h3>
                    <p className="text-sm text-gray-700">{renovacionComparacion.resumen}</p>
                  </div>
                )}

                {/* Tabla comparativa */}
                {renovacionComparacion.polizas?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tabla comparativa</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left py-2 px-3 bg-gray-100 text-gray-600 font-semibold rounded-tl-lg w-36">Campo</th>
                            {renovacionComparacion.polizas.map((p) => (
                              <th key={p.id} className={`py-2 px-3 text-center font-semibold text-sm ${
                                p.id === renovacionComparacion.recomendacion?.mejor_id
                                  ? 'bg-green-100 text-green-800 border-b-2 border-green-400' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {p.etiqueta || p.compania || `Póliza ${p.id}`}
                                {p.id === renovacionComparacion.recomendacion?.mejor_id && (
                                  <span className="ml-1 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">Mejor</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Compañía</td>
                            {renovacionComparacion.polizas.map((p) => (
                              <td key={p.id} className="py-2 px-3 text-center text-gray-700">{p.compania || '—'}</td>
                            ))}
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Prima anual</td>
                            {renovacionComparacion.polizas.map((p) => (
                              <td key={p.id} className="py-2 px-3 text-center text-gray-700">
                                {p.prima_anual != null ? `${formatearMiles(parseFloat(p.prima_anual).toFixed(2))} €` : '—'}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Capital asegurado</td>
                            {renovacionComparacion.polizas.map((p) => (
                              <td key={p.id} className="py-2 px-3 text-center text-gray-700 text-xs">{p.capital_asegurado || '—'}</td>
                            ))}
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Franquicia</td>
                            {renovacionComparacion.polizas.map((p) => (
                              <td key={p.id} className="py-2 px-3 text-center text-gray-700 text-xs">{p.franquicia || '—'}</td>
                            ))}
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50 align-top">Riesgos cubiertos</td>
                            {renovacionComparacion.polizas.map((p) => (
                              <td key={p.id} className="py-2 px-3 align-top">
                                {Array.isArray(p.riesgos_cubiertos) && p.riesgos_cubiertos.length > 0 ? (
                                  <ul className="space-y-0.5">
                                    {p.riesgos_cubiertos.map((r, i) => (
                                      <li key={i} className="text-xs text-green-700 flex items-start gap-1"><span className="mt-0.5">✅</span> {r}</li>
                                    ))}
                                  </ul>
                                ) : <span className="text-gray-400 text-xs">—</span>}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50 align-top">Fortalezas</td>
                            {renovacionComparacion.polizas.map((p) => (
                              <td key={p.id} className="py-2 px-3 text-xs text-green-700 bg-green-50 align-top">{p.fortalezas || '—'}</td>
                            ))}
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Valoración</td>
                            {renovacionComparacion.polizas.map((p) => (
                              <td key={p.id} className="py-2 px-3 text-center">
                                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                                  p.valoracion >= 7 ? 'bg-green-100 text-green-700' :
                                  p.valoracion >= 5 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {p.valoracion != null ? `${p.valoracion}/10` : '—'}
                                </span>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tabla coberturas */}
                {renovacionComparacion.tabla_coberturas?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Coberturas por póliza</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left py-2 px-3 bg-gray-100 text-gray-600 font-semibold rounded-tl-lg">Cobertura</th>
                            {renovacionComparacion.polizas?.map((p) => (
                              <th key={p.id} className="py-2 px-3 text-center bg-gray-100 text-gray-600 font-semibold text-xs">
                                {p.compania || `Póliza ${p.id}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {renovacionComparacion.tabla_coberturas.map((fila, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="py-2 px-3 text-gray-700 font-medium bg-gray-50 text-xs">{fila.cobertura}</td>
                              {(fila.valores || []).map((v, j) => (
                                <td key={j} className={`py-2 px-3 text-center text-base ${
                                  v === '✅' ? 'bg-green-50 text-green-700' :
                                  v === '❌' ? 'bg-red-50 text-red-700' :
                                  v === '⚠️' ? 'bg-yellow-50 text-yellow-700' :
                                  'bg-gray-50 text-gray-600'
                                }`}>{v || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recomendación IA */}
                {renovacionComparacion.recomendacion && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Recomendación IA</h3>
                    <p className="text-sm text-green-800">{renovacionComparacion.recomendacion.texto}</p>
                  </div>
                )}

                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setPasoRenovar('form'); setError(''); }} className="btn-secundario">Atrás</button>
                  <button type="button" onClick={() => { setModalRenovar(false); setError(''); }} className="btn-secundario flex-1">No renovar</button>
                  <button type="button" onClick={handleConfirmarRenovacion} disabled={guardandoRenovacion} className="btn-primario flex-1 justify-center">
                    {guardandoRenovacion ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Sí, renovar'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Paso 5: Confirmar (sin comparación) */}
        {pasoRenovar === 'confirmar' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Resumen de la renovación</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                {renovarForm.nueva_compania_aseguradora && (
                  <div className="col-span-2"><span className="text-gray-400">Compañía:</span> {renovarForm.nueva_compania_aseguradora}</div>
                )}
                {renovarForm.nuevo_numero_poliza && (
                  <div><span className="text-gray-400">Nº póliza:</span> {renovarForm.nuevo_numero_poliza}</div>
                )}
                <div><span className="text-gray-400">Inicio:</span> {renovarForm.nueva_fecha_inicio ? new Date(renovarForm.nueva_fecha_inicio + 'T00:00:00').toLocaleDateString('es-ES') : '—'}</div>
                <div><span className="text-gray-400">Vencimiento:</span> {renovarForm.nueva_fecha_vencimiento ? new Date(renovarForm.nueva_fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-ES') : '—'}</div>
                {renovarForm.nuevo_importe && (
                  <div><span className="text-gray-400">Importe anual:</span> {formatearMiles(parseFloat(renovarForm.nuevo_importe).toFixed(2))} €</div>
                )}
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setPasoRenovar('form'); setError(''); }} className="btn-secundario">Atrás</button>
              <button type="button" onClick={() => { setModalRenovar(false); setError(''); }} className="btn-secundario flex-1">No renovar</button>
              <button type="button" onClick={handleConfirmarRenovacion} disabled={guardandoRenovacion} className="btn-primario flex-1 justify-center">
                {guardandoRenovacion ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Sí, renovar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal historial */}
      <Modal abierto={modalHistorial} onCerrar={() => setModalHistorial(false)} titulo={`Historial — ${polizaHistorial?.numero_poliza || ''}`} ancho="max-w-xl">
        {cargandoHistorial ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" /></div>
        ) : historial.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Esta póliza no tiene renovaciones anteriores.</p>
        ) : (
          <div className="space-y-3">
            {historial.map((h, i) => (
              <div key={h.id} className="bg-gray-50 rounded-lg p-4 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Renovación {historial.length - i}</span>
                  <span className="text-xs text-gray-400">{new Date(h.fecha_renovacion).toLocaleDateString('es-ES')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                  {h.compania_aseguradora && (
                    <div className="col-span-2"><span className="text-gray-400">Compañía:</span> {h.compania_aseguradora}</div>
                  )}
                  {h.numero_poliza && (
                    <div className="col-span-2"><span className="text-gray-400">Nº póliza:</span> <span className="font-mono">{h.numero_poliza}</span></div>
                  )}
                  <div><span className="text-gray-400">Inicio:</span> {h.fecha_inicio ? new Date(h.fecha_inicio).toLocaleDateString('es-ES') : '—'}</div>
                  <div><span className="text-gray-400">Vencimiento:</span> {h.fecha_vencimiento ? new Date(h.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}</div>
                  <div><span className="text-gray-400">Importe:</span> {h.importe ? `${formatearMiles(parseFloat(h.importe).toFixed(2))} €` : '—'}</div>
                  {h.documento_url && (
                    <div>
                      <a href={urlDoc(h.documento_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                        <FileText size={14} /> Ver PDF
                      </a>
                    </div>
                  )}
                </div>
                {h.notas && <p className="text-gray-500 text-xs mt-2 italic">{h.notas}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal eliminar */}
      <Modal abierto={!!confirmandoEliminar} onCerrar={() => setConfirmandoEliminar(null)} titulo="Confirmar eliminación" ancho="max-w-sm">
        <p className="text-gray-600 text-sm mb-6">
          ¿Eliminar la póliza <strong>{confirmandoEliminar?.numero_poliza || 'seleccionada'}</strong> de {confirmandoEliminar?.nombre_inmueble}? También se eliminarán sus siniestros e historial.
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
        tipo="inmuebles"
      />

      {/* Modal comparador de renovación */}
      <ModalComparador
        abierto={!!resultadoRenovacion}
        onCerrar={() => setResultadoRenovacion(null)}
        onDescargar={() => { setResultadoRenovacion(null); setModoRenovacion(false); setRenovacionPolizaId(null); setRenovacionArchivo(null); }}
        datos={resultadoRenovacion}
        tipo="inmuebles"
        tituloOverride="Comparador de renovación"
      />


      {/* Modal Ficha de Póliza Inmueble — diseño oscuro profesional */}
      {modalFicha && polizaFicha && (() => {
        const p = polizaFicha;
        const estado = calcularEstado(p.fecha_vencimiento, p.tipo_inmueble);
        const estadoDark = estado.etiqueta.startsWith('Vig')
          ? { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)', text: '#4ade80', label: 'VIGENTE' }
          : estado.etiqueta === 'Vencida'
          ? { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)', text: '#f87171', label: 'VENCIDA' }
          : { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24', label: estado.etiqueta.toUpperCase() };
        const capitales = CAPITALES_ASEGURADOS_INMUEBLE.map(({ key, label }) => ({ key, label, valor: p[key] }));
        const noContratadas = COBERTURAS_NO_CONTRATADAS_INMUEBLE.map(({ key, label }) => ({ key, label, activo: !!p[key] }));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && setModalFicha(false)}>
            <div className="absolute inset-0 bg-[#0D1B2A]/80 backdrop-blur-md" onClick={() => setModalFicha(false)} />
            <div className="relative z-10 flex flex-col fixed inset-0 sm:static sm:inset-auto sm:max-w-[760px] sm:w-full sm:rounded-2xl sm:max-h-[92vh] overflow-hidden"
              style={{ background: 'rgba(15,25,45,0.94)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 60px rgba(0,0,0,0.55)' }}>

              {/* HEADER: compañía + nº póliza + badge estado */}
              <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(99,102,241,0.08), transparent)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    <Shield size={18} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-white truncate">{p.compania_aseguradora || 'Sin compañía'}</h2>
                    <p className="text-[11px] font-mono text-white/40 truncate">{p.numero_poliza || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider"
                    style={{ background: estadoDark.bg, color: estadoDark.text, border: `1px solid ${estadoDark.border}` }}>
                    {estadoDark.label}
                  </span>
                  <button type="button" onClick={() => setModalFicha(false)} className="p-1.5 rounded-lg transition-colors hover:bg-white/10 text-white/40 hover:text-white/80">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* BODY */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Datos generales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: Home, label: 'Inmueble', valor: p.nombre_inmueble || '—' },
                    { icon: Shield, label: 'Tipo', valor: etiquetaTipo(p.tipo) || '—' },
                    { icon: Calendar, label: 'Inicio', valor: p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-ES') : '—' },
                    { icon: Calendar, label: 'Vencimiento', valor: p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString('es-ES') : '—' },
                  ].map((t, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1">
                        <t.icon size={11} /> {t.label}
                      </div>
                      <p className="text-sm font-semibold text-white/90 truncate">{t.valor}</p>
                    </div>
                  ))}
                </div>

                {/* Importe anual destacado */}
                {p.importe_anual && (
                  <div className="flex items-center justify-between px-5 py-3 rounded-xl"
                    style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <div className="flex items-center gap-2">
                      <Euro size={16} className="text-emerald-400" />
                      <span className="text-xs uppercase tracking-wider text-emerald-300/80">Prima anual</span>
                    </div>
                    <span className="text-xl font-bold text-emerald-400">{formatearMiles(parseFloat(p.importe_anual).toFixed(2))} €</span>
                  </div>
                )}

                {/* Dirección bien asegurado */}
                {p.direccion_bien_asegurado && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Bien asegurado</p>
                    <p className="text-sm text-white/80">{p.direccion_bien_asegurado}</p>
                  </div>
                )}

                {/* Coberturas y capitales asegurados */}
                {capitales.some((c) => c.valor != null) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #10b981, #059669)' }} />
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-400/90">Coberturas y capitales asegurados</h3>
                    </div>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.15)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'rgba(16,185,129,0.08)' }}>
                            <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-emerald-300/70 font-semibold">Cobertura</th>
                            <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-emerald-300/70 font-semibold">Capital</th>
                          </tr>
                        </thead>
                        <tbody>
                          {capitales.map((c, i) => (
                            <tr key={c.key} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-4 py-2 text-white/70">
                                {c.valor != null ? <CheckCircle size={14} className="inline text-emerald-400 mr-1.5" /> : <X size={14} className="inline text-white/20 mr-1.5" />}
                                {c.label}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {c.valor != null ? (
                                  <span className="font-bold text-emerald-300">{formatearMiles(parseFloat(c.valor).toFixed(2))} €</span>
                                ) : (
                                  <span className="text-white/25 text-xs">No contratado</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Coberturas NO contratadas */}
                {noContratadas.some((c) => c.activo) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #ef4444, #b91c1c)' }} />
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-red-400/90">Coberturas NO contratadas</h3>
                    </div>
                    <div className="rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {noContratadas.filter((c) => c.activo).map((c) => (
                        <div key={c.key} className="flex items-center gap-2 text-sm text-red-300/90">
                          <X size={14} className="text-red-400 flex-shrink-0" />
                          <span>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Franquicias destacadas */}
                {p.franquicias && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #f59e0b, #d97706)' }} />
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-amber-400/90">Franquicias aplicables</h3>
                    </div>
                    <div className="rounded-xl p-4 text-sm text-amber-100/90 leading-relaxed whitespace-pre-line"
                      style={{ background: 'linear-gradient(90deg, rgba(251,191,36,0.1), rgba(251,191,36,0.04))', border: '1px solid rgba(251,191,36,0.3)' }}>
                      <AlertTriangle size={14} className="inline text-amber-400 mr-1.5 -mt-0.5" />
                      {p.franquicias}
                    </div>
                  </div>
                )}

                {/* Datos del tomador */}
                {(p.tomador_poliza || p.tomador_cif_nif || p.tomador_telefono || p.tomador_email || p.tomador_banco_domiciliacion) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #6366f1, #4f46e5)' }} />
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400/90">Datos del tomador</h3>
                    </div>
                    <div className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      {[
                        { label: 'Nombre', valor: p.tomador_poliza },
                        { label: 'CIF/NIF', valor: p.tomador_cif_nif, mono: true },
                        { label: 'Teléfono', valor: p.tomador_telefono },
                        { label: 'Email', valor: p.tomador_email },
                        { label: 'Banco domiciliación', valor: p.tomador_banco_domiciliacion },
                      ].filter((d) => d.valor).map((d, i) => (
                        <div key={i}>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{d.label}</p>
                          <p className={`text-sm text-white/90 ${d.mono ? 'font-mono' : ''}`}>{d.valor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agente / contacto compañía */}
                {(p.contacto_nombre || p.contacto_telefono || p.contacto_email) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #06b6d4, #0891b2)' }} />
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-400/90">Contacto compañía / agente</h3>
                    </div>
                    <div className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
                      {[
                        { label: 'Nombre', valor: p.contacto_nombre },
                        { label: 'Teléfono', valor: p.contacto_telefono },
                        { label: 'Email', valor: p.contacto_email },
                      ].filter((d) => d.valor).map((d, i) => (
                        <div key={i}>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{d.label}</p>
                          <p className="text-sm text-white/90 truncate">{d.valor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div className="flex items-center gap-2 px-6 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                {p.documento_url && (
                  <a href={urlDoc(p.documento_url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white/70 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <FileText size={14} /> Ver PDF
                  </a>
                )}
                <button type="button" onClick={() => { setModalFicha(false); abrirEditar(p); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white/70 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Pencil size={14} /> Editar
                </button>
                <button type="button" onClick={() => { setModalFicha(false); abrirRenovar(p); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:shadow-lg hover:shadow-green-500/20"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <RefreshCw size={14} /> Renovar
                </button>
                <div className="flex-1" />
                <button type="button" onClick={() => setModalFicha(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  );
}
