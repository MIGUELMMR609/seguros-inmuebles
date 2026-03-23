import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, FileText, AlertTriangle, Sparkles, RefreshCw, Download, Scale, Home, Store, Eye, ClipboardCheck, Euro, Target, Save, CheckCircle, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { imprimirInformePoliza } from '../utils/imprimirInforme.js';
import { formatearMiles, limpiarMiles } from '../utils/moneda.js';
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
  obtenerPropuestasApi,
  eliminarPropuestaApi,
  crearPropuestaApi,
  obtenerPolizasApi,
  generarPolizaOptimaApi,
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
  datos_inmueble: null,
};

const datosInmuebleVacio = {
  tipo_inmueble: '', // 'vivienda' o 'local_negocio'
  // Vivienda
  tiene_mascotas: false,
  tiene_objetos_valor: false,
  valor_objetos_valor: '',
  num_personas: '',
  tiene_vehiculo_garaje: false,
  // Local de negocio
  tipo_negocio: '',
  tiene_mercancia: false,
  valor_mercancia: '',
  tiene_empleados: false,
  num_empleados: '',
  atiende_publico: false,
  tiene_maquinaria: false,
  necesita_rc_empleados: false,
  necesita_rc_explotacion: false,
  necesita_defensa_juridica: false,
  necesita_equipos_electronicos: false,
  valor_equipos_electronicos: '',
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

  // Propuestas pendientes
  const [propuestas, setPropuestas] = useState([]);
  const [propuestaVer, setPropuestaVer] = useState(null);
  const [confirmandoEliminarPropuesta, setConfirmandoEliminarPropuesta] = useState(null);

  // Modal Póliza Óptima
  const [modalOptima, setModalOptima] = useState(false);
  const [optimaPaso, setOptimaPaso] = useState(1);
  const [polizasInmuebles, setPolizasInmuebles] = useState([]);
  const [optimaPolizaId, setOptimaPolizaId] = useState('');
  const [optimaDatos, setOptimaDatos] = useState({ ...datosInmuebleVacio });
  const [optimaInforme, setOptimaInforme] = useState(null);
  const [optimaError, setOptimaError] = useState('');
  const [guardandoPropuesta, setGuardandoPropuesta] = useState(false);
  const [propuestaGuardada, setPropuestaGuardada] = useState(false);
  const [propuestaInquilinoId, setPropuestaInquilinoId] = useState('');

  async function abrirOptima() {
    setOptimaPolizaId('');
    setOptimaDatos({ ...datosInmuebleVacio });
    setOptimaPaso(1);
    setOptimaInforme(null);
    setOptimaError('');
    setPropuestaGuardada(false);
    setPropuestaInquilinoId('');
    setModalOptima(true);
    try {
      const res = await obtenerPolizasApi();
      setPolizasInmuebles(res.data);
    } catch {
      setPolizasInmuebles([]);
    }
  }

  async function handleGenerarInforme() {
    setOptimaPaso(4);
    setOptimaError('');
    try {
      const res = await generarPolizaOptimaApi({
        poliza_inmueble_id: parseInt(optimaPolizaId),
        datos_inmueble: optimaDatos,
      });
      setOptimaInforme(res.data);
      setOptimaPaso(5);
    } catch (err) {
      setOptimaError(err.response?.data?.error || 'Error al generar el informe');
      setOptimaPaso(3);
    }
  }

  async function cargar() {
    try {
      const [resPolizas, resInquilinos, resTodas, resPropuestas] = await Promise.all([
        obtenerPolizasInquilinosApi(filtroInquilino ? { inquilino_id: filtroInquilino } : {}),
        obtenerInquilinosApi(),
        obtenerPolizasInquilinosApi({}),
        obtenerPropuestasApi(),
      ]);
      setPolizas(resPolizas.data);
      setInquilinos(resInquilinos.data);
      setPropuestas(resPropuestas.data);

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
      datos_inmueble: poliza.datos_inmueble || null,
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

  async function handleEliminarPropuesta(id) {
    try {
      await eliminarPropuestaApi(id);
      setConfirmandoEliminarPropuesta(null);
      setPropuestas((prev) => prev.filter((p) => p.id !== id));
      setToast({ mensaje: 'Propuesta eliminada', tipo: 'success' });
    } catch {
      setToast({ mensaje: 'Error al eliminar la propuesta', tipo: 'error' });
    }
  }

  function generarPdfInforme(inf, nombreInmueble, compania, nombreInquilino, fechaStr) {
    if (!inf) return;
    const doc = new jsPDF();
    const fecha = fechaStr || new Date().toLocaleDateString('es-ES');
    const slugInmueble = (nombreInmueble || 'inmueble').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').substring(0, 40);
    const fechaArchivo = new Date().toISOString().split('T')[0];
    const nombreArchivo = `propuesta_poliza_${slugInmueble}_${fechaArchivo}.pdf`;

    // Header
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('Informe Poliza Optima Inquilino', 14, 18);

    let y = 38;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (nombreInmueble) { doc.text(`Inmueble: ${nombreInmueble}${compania ? ' — ' + compania : ''}`, 14, y); y += 6; }
    if (nombreInquilino) { doc.text(`Inquilino: ${nombreInquilino}`, 14, y); y += 6; }
    doc.text(`Fecha: ${fecha}`, 14, y); y += 10;

    // New table format
    if (inf.tabla_coberturas && inf.tabla_coberturas.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Cobertura / Riesgo', 'Cubierto propietario', 'Contratar inquilino']],
        body: inf.tabla_coberturas.map((r) => [
          r.concepto || '',
          r.propietario ? 'SI' : '—',
          r.inquilino ? 'SI' : '—',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 95], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 40, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.column.index === 1 && data.cell.raw === 'SI') {
              data.cell.styles.textColor = [22, 101, 52];
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 2 && data.cell.raw === 'SI') {
              data.cell.styles.textColor = [29, 78, 216];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Old format fallback
    if (!inf.tabla_coberturas) {
      const secciones = [
        { titulo: 'Cubierto por el propietario', texto: inf.resumen_poliza_propietario },
        { titulo: 'Huecos de cobertura', texto: inf.huecos_cobertura },
        { titulo: 'Coberturas imprescindibles', texto: inf.poliza_optima?.coberturas_imprescindibles },
        { titulo: 'Coberturas recomendables', texto: inf.poliza_optima?.coberturas_recomendables },
        { titulo: 'Riesgos sin cubrir', texto: inf.riesgos_sin_cubrir },
        { titulo: 'Consejos adicionales', texto: inf.consejos_adicionales },
      ];
      for (const s of secciones) {
        if (!s.texto) continue;
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 95);
        doc.text(s.titulo, 14, y); y += 6;
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(s.texto, 180);
        doc.text(lines, 14, y); y += lines.length * 4.5 + 6;
      }
    }

    // Tipo recomendado
    const tipoRec = inf.tipo_recomendado || inf.poliza_optima?.tipo_recomendado;
    if (tipoRec) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 95);
      doc.text('Tipo de seguro recomendado', 14, y); y += 6;
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(tipoRec, 14, y); y += 8;
    }

    // Resumen
    const resumen = inf.resumen || inf.consejos_adicionales;
    if (inf.resumen) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 95);
      doc.text('Resumen y recomendacion', 14, y); y += 6;
      doc.setFontSize(9);
      doc.setTextColor(60);
      const lines = doc.splitTextToSize(inf.resumen, 180);
      doc.text(lines, 14, y); y += lines.length * 4.5 + 6;
    }

    // Precio
    const precio = inf.precio_orientativo || inf.poliza_optima?.precio_orientativo;
    if (precio) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(14, y - 4, 180, 12, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setTextColor(22, 101, 52);
      doc.text(`Precio orientativo: ${precio}`, 18, y + 4);
      y += 16;
    }

    // Compañías
    const companias = inf.companias_recomendadas || (inf.poliza_optima?.companias_sugeridas ? [inf.poliza_optima.companias_sugeridas] : null);
    if (companias && companias.length > 0) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 95);
      doc.text('Companias recomendadas', 14, y); y += 6;
      doc.setFontSize(9);
      doc.setTextColor(60);
      companias.forEach((c) => {
        const lines = doc.splitTextToSize(`- ${c}`, 176);
        doc.text(lines, 18, y);
        y += lines.length * 4.5 + 2;
      });
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(170);
    doc.text('Generado automaticamente - Solo orientativo, consulte con su corredor de seguros', 14, 288);

    doc.save(nombreArchivo);
  }

  function descargarPdfPropuesta(prop) {
    const inf = prop.informe;
    if (!inf) return;
    generarPdfInforme(
      inf,
      prop.poliza_inmueble_info?.nombre_inmueble,
      prop.poliza_inmueble_info?.compania,
      prop.nombre_inquilino,
      new Date(prop.created_at).toLocaleDateString('es-ES')
    );
  }

  function contratarDesdePropuesta(prop) {
    const inf = prop.informe;
    const tipoRec = inf?.tipo_recomendado || inf?.poliza_optima?.tipo_recomendado || '';
    const precio = inf?.precio_orientativo || inf?.poliza_optima?.precio_orientativo || '';
    const coberturas = inf?.tabla_coberturas
      ? inf.tabla_coberturas.filter((r) => r.inquilino).map((r) => r.concepto).join(', ')
      : inf?.poliza_optima?.coberturas_imprescindibles || '';
    setEditando(null);
    setFormulario({
      ...formularioVacio,
      inquilino_id: prop.inquilino_id || '',
      tipo: tipoRec.toLowerCase().includes('local') ? 'local_negocio'
           : tipoRec.toLowerCase().includes('vida') ? 'vida'
           : tipoRec.toLowerCase().includes('rc') ? 'responsabilidad_civil'
           : 'hogar',
      notas: `Propuesta IA: ${tipoRec}\nCoberturas: ${coberturas}\nPrecio orientativo: ${precio}`,
      datos_inmueble: prop.datos_inmueble || null,
    });
    setError('');
    setPasoModal('form');
    setModalAbierto(true);
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
      render: (f) => f.importe_anual ? `${formatearMiles(parseFloat(f.importe_anual).toFixed(2))} €` : '—',
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
        <div className="flex gap-2">
          <button onClick={abrirOptima} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm transition-all">
            <Target size={16} /> Póliza Óptima
          </button>
          <button onClick={abrirCrear} className="btn-primario">
            <Plus size={16} /> Nueva póliza
          </button>
        </div>
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

      {/* Propuestas pendientes — debajo de la lista de pólizas */}
      {propuestas.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ClipboardCheck size={20} className="text-emerald-600" />
            Propuestas pendientes de contratar
            <span className="text-sm font-normal text-gray-400 ml-1">({propuestas.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {propuestas.map((prop) => (
              <div key={prop.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{prop.nombre_inquilino || 'Sin inquilino asignado'}</p>
                    <p className="text-xs text-gray-400">{prop.nombre_inmueble || 'Sin inmueble'}</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(prop.created_at).toLocaleDateString('es-ES')}</span>
                </div>
                {(prop.informe?.tipo_recomendado || prop.informe?.poliza_optima?.tipo_recomendado) && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md mb-2 inline-block font-medium">
                    {prop.informe.tipo_recomendado || prop.informe.poliza_optima.tipo_recomendado}
                  </p>
                )}
                {(prop.informe?.precio_orientativo || prop.informe?.poliza_optima?.precio_orientativo) && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <Euro size={12} /> {prop.informe.precio_orientativo || prop.informe.poliza_optima.precio_orientativo}
                  </div>
                )}
                {prop.informe?.tabla_coberturas ? (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                    {prop.informe.tabla_coberturas.filter((r) => r.inquilino).map((r) => r.concepto).join(', ')}
                  </p>
                ) : prop.informe?.poliza_optima?.coberturas_imprescindibles ? (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{prop.informe.poliza_optima.coberturas_imprescindibles}</p>
                ) : null}
                <div className="flex gap-2">
                  <button onClick={() => setPropuestaVer(prop)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    <Eye size={13} /> Ver informe
                  </button>
                  <button onClick={() => contratarDesdePropuesta(prop)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
                    <Plus size={13} /> Contratar
                  </button>
                  <button onClick={() => descargarPdfPropuesta(prop)} className="px-2 py-1.5 text-xs text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Descargar PDF">
                    <Download size={13} />
                  </button>
                  <button onClick={() => setConfirmandoEliminarPropuesta(prop)} className="px-2 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

            {/* Datos del inmueble: vivienda o local */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos del inmueble asegurado</h3>
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setFormulario((prev) => ({
                    ...prev,
                    datos_inmueble: { ...datosInmuebleVacio, tipo_inmueble: 'vivienda' },
                  }))}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    formulario.datos_inmueble?.tipo_inmueble === 'vivienda'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Home size={18} />
                  <span>🏠 Vivienda</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormulario((prev) => ({
                    ...prev,
                    datos_inmueble: { ...datosInmuebleVacio, tipo_inmueble: 'local_negocio' },
                  }))}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    formulario.datos_inmueble?.tipo_inmueble === 'local_negocio'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Store size={18} />
                  <span>🏪 Local de negocio</span>
                </button>
              </div>

              {/* Campos para VIVIENDA */}
              {formulario.datos_inmueble?.tipo_inmueble === 'vivienda' && (
                <div className="grid grid-cols-2 gap-4 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Tiene mascotas?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_mascotas: true } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.tiene_mascotas ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_mascotas: false } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.tiene_mascotas ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">¿Tiene objetos de valor?</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_objetos_valor: true } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.tiene_objetos_valor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_objetos_valor: false } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.tiene_objetos_valor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                      </div>
                    </div>
                    {formulario.datos_inmueble.tiene_objetos_valor && (
                      <input
                        placeholder="Valor aproximado (€)"
                        inputMode="decimal"
                        value={formatearMiles(formulario.datos_inmueble.valor_objetos_valor || '')}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, valor_objetos_valor: limpiarMiles(e.target.value) } }))}
                        className="campo-formulario mt-2 text-sm"
                      />
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Cuántas personas vivirán?</label>
                    <input
                      type="number" min="1" max="20"
                      value={formulario.datos_inmueble.num_personas || ''}
                      onChange={(e) => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, num_personas: e.target.value } }))}
                      className="campo-formulario mt-1 text-sm"
                      placeholder="Nº personas"
                    />
                  </div>

                  <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Tiene vehículo en garaje?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_vehiculo_garaje: true } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.tiene_vehiculo_garaje ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_vehiculo_garaje: false } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.tiene_vehiculo_garaje ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Campos para LOCAL DE NEGOCIO */}
              {formulario.datos_inmueble?.tipo_inmueble === 'local_negocio' && (
                <div className="grid grid-cols-2 gap-4 bg-orange-50/50 border border-orange-100 rounded-xl p-4">
                  <div className="col-span-2">
                    <label className="text-sm text-gray-700">Tipo de negocio</label>
                    <select
                      value={formulario.datos_inmueble.tipo_negocio || ''}
                      onChange={(e) => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tipo_negocio: e.target.value } }))}
                      className="campo-formulario mt-1 text-sm"
                    >
                      <option value="">Selecciona tipo...</option>
                      <option value="tienda">Tienda</option>
                      <option value="oficina">Oficina</option>
                      <option value="restaurante">Restaurante / Bar</option>
                      <option value="taller">Taller / Industria</option>
                      <option value="almacen">Almacén</option>
                      <option value="peluqueria">Peluquería / Estética</option>
                      <option value="clinica">Clínica / Consulta</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">¿Tiene mercancía?</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_mercancia: true } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.tiene_mercancia ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_mercancia: false } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.tiene_mercancia ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                      </div>
                    </div>
                    {formulario.datos_inmueble.tiene_mercancia && (
                      <input
                        placeholder="Valor aproximado (€)"
                        inputMode="decimal"
                        value={formatearMiles(formulario.datos_inmueble.valor_mercancia || '')}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, valor_mercancia: limpiarMiles(e.target.value) } }))}
                        className="campo-formulario mt-2 text-sm"
                      />
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">¿Tiene empleados?</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_empleados: true } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.tiene_empleados ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_empleados: false } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.tiene_empleados ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                      </div>
                    </div>
                    {formulario.datos_inmueble.tiene_empleados && (
                      <input
                        type="number" min="1"
                        placeholder="¿Cuántos?"
                        value={formulario.datos_inmueble.num_empleados || ''}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, num_empleados: e.target.value } }))}
                        className="campo-formulario mt-2 text-sm"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Atiende público?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, atiende_publico: true } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.atiende_publico ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, atiende_publico: false } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.atiende_publico ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Maquinaria o equipos especiales?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_maquinaria: true } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.tiene_maquinaria ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, tiene_maquinaria: false } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.tiene_maquinaria ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Necesita RC empleados?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_rc_empleados: true } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.necesita_rc_empleados ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_rc_empleados: false } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.necesita_rc_empleados ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Necesita RC explotación?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_rc_explotacion: true } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.necesita_rc_explotacion ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_rc_explotacion: false } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.necesita_rc_explotacion ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                    <label className="text-sm text-gray-700">¿Necesita defensa jurídica?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_defensa_juridica: true } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.necesita_defensa_juridica ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                      <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_defensa_juridica: false } }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.necesita_defensa_juridica ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">¿Necesita seguro equipos electrónicos?</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_equipos_electronicos: true } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${formulario.datos_inmueble.necesita_equipos_electronicos ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Sí</button>
                        <button type="button" onClick={() => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, necesita_equipos_electronicos: false } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!formulario.datos_inmueble.necesita_equipos_electronicos ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>No</button>
                      </div>
                    </div>
                    {formulario.datos_inmueble.necesita_equipos_electronicos && (
                      <input
                        placeholder="Valor aproximado equipos (€)"
                        inputMode="decimal"
                        value={formatearMiles(formulario.datos_inmueble.valor_equipos_electronicos || '')}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, datos_inmueble: { ...prev.datos_inmueble, valor_equipos_electronicos: limpiarMiles(e.target.value) } }))}
                        className="campo-formulario mt-2 text-sm"
                      />
                    )}
                  </div>
                </div>
              )}
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

      {/* Modal Póliza Óptima — Dark Glassmorphism Wizard */}
      {modalOptima && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && setModalOptima(false)}>
          <div className="absolute inset-0 bg-[#0D1B2A]/80 backdrop-blur-md" onClick={() => setModalOptima(false)} />
          <div className={`relative z-10 flex flex-col fixed inset-0 sm:static sm:inset-auto ${optimaPaso === 5 ? 'sm:max-w-[640px]' : 'sm:max-w-[520px]'} sm:w-full sm:rounded-2xl sm:max-h-[90vh] overflow-hidden transition-all duration-300`}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); e.stopPropagation(); const els = Array.from(e.currentTarget.querySelectorAll('input, select')); const i = els.indexOf(e.target); if (i >= 0 && els[i + 1]) els[i + 1].focus(); } }}
            style={{ background: 'rgba(15,25,45,0.92)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>

            {/* Header: título + progreso en la misma línea */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  <Target size={14} className="text-white" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50 truncate">Poliza Optima</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Progress dots */}
                {[1,2,3,4,5].map((s) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`h-1.5 rounded-full transition-all duration-500 ${optimaPaso >= s ? 'w-5' : 'w-1.5'}`}
                      style={{ background: optimaPaso >= s ? 'linear-gradient(90deg, #6366f1, #a78bfa)' : 'rgba(255,255,255,0.12)' }} />
                  </div>
                ))}
                <button type="button" onClick={() => setModalOptima(false)} className="ml-2 p-1.5 rounded-lg transition-colors hover:bg-white/10 text-white/30 hover:text-white/60">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">

              {/* ── Paso 1: Seleccionar póliza ── */}
              {optimaPaso === 1 && (
                <div className="space-y-3 animate-[fadeSlide_0.3s_ease-out]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-400/80">Selecciona poliza del inmueble</p>
                  {polizasInmuebles.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-xs">No hay polizas de inmuebles registradas.</div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                      {polizasInmuebles.map((p) => (
                        <button key={p.id} type="button" onClick={() => setOptimaPolizaId(String(p.id))}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                            optimaPolizaId === String(p.id)
                              ? 'ring-1 ring-indigo-500/60'
                              : 'hover:bg-white/[0.04]'
                          }`}
                          style={optimaPolizaId === String(p.id) ? { background: 'rgba(99,102,241,0.12)' } : { background: 'rgba(255,255,255,0.02)' }}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            optimaPolizaId === String(p.id) ? 'bg-indigo-500/20' : 'bg-white/5'
                          }`}>
                            <Shield size={14} className={optimaPolizaId === String(p.id) ? 'text-indigo-400' : 'text-white/25'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white/90 truncate">{p.nombre_inmueble || 'Sin inmueble'}</span>
                              {p.documento_url && <FileText size={11} className="text-emerald-400/60 flex-shrink-0" />}
                              {p.riesgos_cubiertos && <Sparkles size={11} className="text-purple-400/60 flex-shrink-0" />}
                            </div>
                            <div className="text-[11px] text-white/35 mt-0.5">
                              {p.compania_aseguradora || 'Sin compania'}
                              {p.importe_anual && <span> · {formatearMiles(parseFloat(p.importe_anual).toFixed(0))} EUR/ano</span>}
                              {p.valoracion && <span className="ml-1 font-semibold text-emerald-400/70">· {p.valoracion}/10</span>}
                            </div>
                          </div>
                          {optimaPolizaId === String(p.id) && (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #a78bfa)' }}>
                              <CheckCircle size={12} className="text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setModalOptima(false)} className="flex-1 px-4 py-2 rounded-full text-xs font-semibold text-white/40 transition-colors hover:text-white/60 hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                    <button type="button" onClick={() => setOptimaPaso(2)} disabled={!optimaPolizaId}
                      className="flex-1 px-4 py-2 rounded-full text-xs font-bold text-white transition-all disabled:opacity-30"
                      style={{ background: optimaPolizaId ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)' }}>
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* ── Paso 2: Tipo de uso ── */}
              {optimaPaso === 2 && (
                <div className="space-y-4 animate-[fadeSlide_0.3s_ease-out]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-400/80">Tipo de uso del inmueble</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setOptimaDatos({ ...datosInmuebleVacio, tipo_inmueble: 'vivienda' })}
                      className={`flex flex-col items-center gap-2 px-4 py-5 rounded-xl transition-all duration-200 ${
                        optimaDatos.tipo_inmueble === 'vivienda' ? 'ring-1 ring-sky-400/50' : 'hover:bg-white/[0.04]'
                      }`}
                      style={optimaDatos.tipo_inmueble === 'vivienda' ? { background: 'rgba(56,189,248,0.1)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: optimaDatos.tipo_inmueble === 'vivienda' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.05)' }}>
                        <Home size={20} className={optimaDatos.tipo_inmueble === 'vivienda' ? 'text-sky-400' : 'text-white/30'} />
                      </div>
                      <span className={`text-xs font-semibold ${optimaDatos.tipo_inmueble === 'vivienda' ? 'text-sky-300' : 'text-white/40'}`}>Vivienda</span>
                    </button>
                    <button type="button" onClick={() => setOptimaDatos({ ...datosInmuebleVacio, tipo_inmueble: 'local_negocio' })}
                      className={`flex flex-col items-center gap-2 px-4 py-5 rounded-xl transition-all duration-200 ${
                        optimaDatos.tipo_inmueble === 'local_negocio' ? 'ring-1 ring-amber-400/50' : 'hover:bg-white/[0.04]'
                      }`}
                      style={optimaDatos.tipo_inmueble === 'local_negocio' ? { background: 'rgba(251,191,36,0.1)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: optimaDatos.tipo_inmueble === 'local_negocio' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)' }}>
                        <Store size={20} className={optimaDatos.tipo_inmueble === 'local_negocio' ? 'text-amber-400' : 'text-white/30'} />
                      </div>
                      <span className={`text-xs font-semibold ${optimaDatos.tipo_inmueble === 'local_negocio' ? 'text-amber-300' : 'text-white/40'}`}>Local negocio</span>
                    </button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setOptimaPaso(1)} className="flex-1 px-4 py-2 rounded-full text-xs font-semibold text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Atras</button>
                    <button type="button" onClick={() => setOptimaPaso(3)} disabled={!optimaDatos.tipo_inmueble}
                      className="flex-1 px-4 py-2 rounded-full text-xs font-bold text-white transition-all disabled:opacity-30"
                      style={{ background: optimaDatos.tipo_inmueble ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)' }}>
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* ── Paso 3: Datos vivienda ── */}
              {optimaPaso === 3 && optimaDatos.tipo_inmueble === 'vivienda' && (
                <div className="space-y-3 animate-[fadeSlide_0.3s_ease-out]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-400/80">Datos de la vivienda</p>
                  {optimaError && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{optimaError}</div>}
                  <div className="space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                    {[
                      { label: 'Mascotas', key: 'tiene_mascotas' },
                      { label: 'Objetos de valor', key: 'tiene_objetos_valor', subKey: 'valor_objetos_valor', subPlaceholder: 'Valor (EUR)' },
                      { label: 'Vehiculo en garaje', key: 'tiene_vehiculo_garaje' },
                    ].map(({ label, key, subKey, subPlaceholder }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-white/60">{label}</span>
                          <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button type="button" onClick={() => setOptimaDatos((p) => ({ ...p, [key]: true }))}
                              className={`px-3 py-1 text-[10px] font-bold transition-all ${optimaDatos[key] ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                              style={optimaDatos[key] ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : {}}>SI</button>
                            <button type="button" onClick={() => setOptimaDatos((p) => ({ ...p, [key]: false }))}
                              className={`px-3 py-1 text-[10px] font-bold transition-all ${!optimaDatos[key] ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                              style={!optimaDatos[key] ? { background: 'rgba(255,255,255,0.1)' } : {}}>NO</button>
                          </div>
                        </div>
                        {subKey && optimaDatos[key] && (
                          <input placeholder={subPlaceholder} inputMode="decimal" value={formatearMiles(optimaDatos[subKey] || '')}
                            onChange={(e) => setOptimaDatos((p) => ({ ...p, [subKey]: limpiarMiles(e.target.value) }))}
                            className="w-full mt-1 px-3 py-1.5 rounded-lg text-xs text-white/90 placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-white/60">Personas</span>
                      <input type="number" min="1" max="20" value={optimaDatos.num_personas} placeholder="N"
                        onChange={(e) => setOptimaDatos((p) => ({ ...p, num_personas: e.target.value }))}
                        className="w-16 px-2 py-1 rounded-lg text-xs text-center text-white/90 placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setOptimaPaso(2); setOptimaError(''); }} className="flex-1 px-4 py-2 rounded-full text-xs font-semibold text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Atras</button>
                    <button type="button" onClick={handleGenerarInforme}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all hover:shadow-lg hover:shadow-indigo-500/20"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      <Sparkles size={13} /> Generar informe
                    </button>
                  </div>
                </div>
              )}

              {/* ── Paso 3: Datos local de negocio ── */}
              {optimaPaso === 3 && optimaDatos.tipo_inmueble === 'local_negocio' && (
                <div className="space-y-3 animate-[fadeSlide_0.3s_ease-out]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400/80">Datos del local</p>
                  {optimaError && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{optimaError}</div>}
                  <div className="space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                    {/* Tipo negocio */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-white/60">Tipo</span>
                      <select value={optimaDatos.tipo_negocio} onChange={(e) => setOptimaDatos((p) => ({ ...p, tipo_negocio: e.target.value }))}
                        className="px-2 py-1 rounded-lg text-xs text-white/90 outline-none focus:ring-1 focus:ring-amber-500/40 appearance-none cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '160px' }}>
                        <option value="" className="bg-[#0f192d]">Selecciona...</option>
                        <option value="tienda" className="bg-[#0f192d]">Tienda</option>
                        <option value="oficina" className="bg-[#0f192d]">Oficina</option>
                        <option value="restaurante" className="bg-[#0f192d]">Restaurante/Bar</option>
                        <option value="taller" className="bg-[#0f192d]">Taller/Industria</option>
                        <option value="almacen" className="bg-[#0f192d]">Almacen</option>
                        <option value="peluqueria" className="bg-[#0f192d]">Peluqueria</option>
                        <option value="clinica" className="bg-[#0f192d]">Clinica</option>
                        <option value="otro" className="bg-[#0f192d]">Otro</option>
                      </select>
                    </div>
                    {/* Boolean toggles */}
                    {[
                      { label: 'Mercancia', key: 'tiene_mercancia', subKey: 'valor_mercancia', subPlaceholder: 'Valor (EUR)' },
                      { label: 'Empleados', key: 'tiene_empleados', subKey: 'num_empleados', subPlaceholder: 'Cuantos', subType: 'number' },
                      { label: 'Atiende publico', key: 'atiende_publico' },
                      { label: 'Maquinaria', key: 'tiene_maquinaria' },
                      { label: 'RC empleados', key: 'necesita_rc_empleados' },
                      { label: 'RC explotacion', key: 'necesita_rc_explotacion' },
                      { label: 'Defensa juridica', key: 'necesita_defensa_juridica' },
                      { label: 'Equipos electronicos', key: 'necesita_equipos_electronicos', subKey: 'valor_equipos_electronicos', subPlaceholder: 'Valor (EUR)' },
                    ].map(({ label, key, subKey, subPlaceholder, subType }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-white/60">{label}</span>
                          <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button type="button" onClick={() => setOptimaDatos((p) => ({ ...p, [key]: true }))}
                              className={`px-3 py-1 text-[10px] font-bold transition-all ${optimaDatos[key] ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                              style={optimaDatos[key] ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : {}}>SI</button>
                            <button type="button" onClick={() => setOptimaDatos((p) => ({ ...p, [key]: false }))}
                              className={`px-3 py-1 text-[10px] font-bold transition-all ${!optimaDatos[key] ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                              style={!optimaDatos[key] ? { background: 'rgba(255,255,255,0.1)' } : {}}>NO</button>
                          </div>
                        </div>
                        {subKey && optimaDatos[key] && (
                          <input type={subType || 'text'} min={subType === 'number' ? '1' : undefined}
                            inputMode={subType === 'number' ? undefined : 'decimal'}
                            placeholder={subPlaceholder} value={subType === 'number' ? (optimaDatos[subKey] || '') : formatearMiles(optimaDatos[subKey] || '')}
                            onChange={(e) => setOptimaDatos((p) => ({ ...p, [subKey]: subType === 'number' ? e.target.value : limpiarMiles(e.target.value) }))}
                            className="w-full mt-1 px-3 py-1.5 rounded-lg text-xs text-white/90 placeholder-white/20 outline-none focus:ring-1 focus:ring-amber-500/40"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setOptimaPaso(2); setOptimaError(''); }} className="flex-1 px-4 py-2 rounded-full text-xs font-semibold text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Atras</button>
                    <button type="button" onClick={handleGenerarInforme}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all hover:shadow-lg hover:shadow-amber-500/20"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <Sparkles size={13} /> Generar informe
                    </button>
                  </div>
                </div>
              )}

              {/* ── Paso 4: Analizando ── */}
              {optimaPaso === 4 && (
                <div className="flex flex-col items-center justify-center py-16 text-center animate-[fadeSlide_0.3s_ease-out]">
                  <div className="relative w-16 h-16 mb-5">
                    <div className="absolute inset-0 rounded-2xl animate-pulse" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-transparent border-t-indigo-400 border-r-purple-400" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white/80">Analizando con IA...</p>
                  <p className="text-[11px] text-white/30 mt-1">Comparando coberturas. Puede tardar hasta 2 min.</p>
                </div>
              )}

              {/* ── Paso 5: Informe ── */}
              {optimaPaso === 5 && optimaInforme && (() => {
                const inf = optimaInforme.informe;
                return (
                <div className="space-y-3 animate-[fadeSlide_0.3s_ease-out]">
                  {/* Badge info */}
                  {optimaInforme.poliza_inmueble && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white/50" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {optimaInforme.poliza_inmueble.nombre_inmueble}
                      </span>
                      {optimaInforme.poliza_inmueble.compania && <span className="text-[10px] text-white/30">{optimaInforme.poliza_inmueble.compania}</span>}
                      {optimaInforme.poliza_inmueble.tiene_pdf && <FileText size={10} className="text-emerald-400/50" />}
                      {optimaInforme.poliza_inmueble.tiene_analisis && <Sparkles size={10} className="text-purple-400/50" />}
                    </div>
                  )}

                  {/* Tabla coberturas — new format */}
                  {inf?.tabla_coberturas && (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Cobertura</th>
                            <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400/60 w-24">Propietario</th>
                            <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-400/60 w-24">Inquilino</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inf.tabla_coberturas.map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-3 py-1.5 text-white/70">{row.concepto}</td>
                              <td className="text-center px-2 py-1.5">{row.propietario ? <span className="text-emerald-400 font-bold">SI</span> : <span className="text-white/15">—</span>}</td>
                              <td className="text-center px-2 py-1.5">{row.inquilino ? <span className="text-sky-400 font-bold">SI</span> : <span className="text-white/15">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Old format fallbacks */}
                  {!inf?.tabla_coberturas && inf?.resumen_poliza_propietario && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.12)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-sky-400/60 mb-1.5">Cubierto por propietario</p>
                      <p className="text-xs text-white/60 whitespace-pre-line leading-relaxed">{inf.resumen_poliza_propietario}</p>
                    </div>
                  )}
                  {!inf?.tabla_coberturas && inf?.huecos_cobertura && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-red-400/60 mb-1.5">Huecos de cobertura</p>
                      <p className="text-xs text-white/60 whitespace-pre-line leading-relaxed">{inf.huecos_cobertura}</p>
                    </div>
                  )}
                  {!inf?.tabla_coberturas && inf?.poliza_optima && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400/60 mb-1.5">Poliza optima</p>
                      {inf.poliza_optima.coberturas_imprescindibles && <p className="text-xs text-white/60 whitespace-pre-line">{inf.poliza_optima.coberturas_imprescindibles}</p>}
                    </div>
                  )}
                  {!inf?.tabla_coberturas && inf?.riesgos_sin_cubrir && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.12)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-orange-400/60 mb-1.5">Riesgos sin cubrir</p>
                      <p className="text-xs text-white/60 whitespace-pre-line">{inf.riesgos_sin_cubrir}</p>
                    </div>
                  )}

                  {/* Tipo + Resumen + Precio + Companias — both formats */}
                  {(inf?.tipo_recomendado || inf?.poliza_optima?.tipo_recomendado) && (
                    <div className="flex items-center gap-2">
                      <Target size={13} className="text-indigo-400/70" />
                      <span className="text-xs font-bold text-white/80">{inf.tipo_recomendado || inf.poliza_optima.tipo_recomendado}</span>
                    </div>
                  )}
                  {(inf?.resumen || (!inf?.tabla_coberturas && inf?.consejos_adicionales)) && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-xs text-white/55 leading-relaxed whitespace-pre-line">{inf.resumen || inf.consejos_adicionales}</p>
                    </div>
                  )}
                  {(inf?.precio_orientativo || inf?.poliza_optima?.precio_orientativo) && (
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <Euro size={14} className="text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-300">{inf.precio_orientativo || inf.poliza_optima.precio_orientativo}</span>
                    </div>
                  )}
                  {(inf?.companias_recomendadas || inf?.poliza_optima?.companias_sugeridas) && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30">Companias</p>
                      {(inf.companias_recomendadas || [inf.poliza_optima.companias_sugeridas]).map((c, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/55" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <Shield size={11} className="text-indigo-400/50 flex-shrink-0" /> {c}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Guardar propuesta */}
                  <div className="pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {!propuestaGuardada ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30">Guardar propuesta</p>
                        <select value={propuestaInquilinoId} onChange={(e) => setPropuestaInquilinoId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg text-xs text-white/80 outline-none focus:ring-1 focus:ring-indigo-500/40 appearance-none cursor-pointer"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <option value="" className="bg-[#0f192d]">Inquilino (opcional)</option>
                          {inquilinos.filter((i) => i.estado === 'activo').map((i) => <option key={i.id} value={i.id} className="bg-[#0f192d]">{i.nombre}</option>)}
                        </select>
                        <button type="button" disabled={guardandoPropuesta}
                          onClick={async () => {
                            setGuardandoPropuesta(true);
                            try {
                              await crearPropuestaApi({
                                inquilino_id: propuestaInquilinoId ? parseInt(propuestaInquilinoId) : null,
                                poliza_inmueble_id: optimaInforme.poliza_inmueble?.id || null,
                                datos_inmueble: optimaDatos,
                                informe: optimaInforme.informe,
                                poliza_inmueble_info: optimaInforme.poliza_inmueble || null,
                              });
                              setPropuestaGuardada(true);
                              await cargar();
                            } catch { setOptimaError('Error al guardar'); }
                            finally { setGuardandoPropuesta(false); }
                          }}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all disabled:opacity-40 hover:shadow-lg hover:shadow-emerald-500/20"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                          {guardandoPropuesta ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-transparent border-t-white" /> : <Save size={12} />}
                          {guardandoPropuesta ? 'Guardando...' : 'Guardar propuesta'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)' }}>
                        <CheckCircle size={14} /> Propuesta guardada
                      </div>
                    )}
                  </div>

                  {/* Acciones finales */}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => generarPdfInforme(inf, optimaInforme.poliza_inmueble?.nombre_inmueble, optimaInforme.poliza_inmueble?.compania)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Download size={12} /> PDF
                    </button>
                    <button type="button" onClick={() => setModalOptima(false)}
                      className="flex-1 px-4 py-2 rounded-full text-xs font-bold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      Cerrar
                    </button>
                  </div>
                </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal ver informe propuesta */}
      <Modal
        abierto={!!propuestaVer}
        onCerrar={() => setPropuestaVer(null)}
        titulo="Informe de propuesta"
        ancho="max-w-2xl"
      >
        {propuestaVer && propuestaVer.informe && (() => {
          const inf = propuestaVer.informe;
          return (
          <div className="space-y-4">
            {propuestaVer.poliza_inmueble_info && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500">
                Base: <strong>{propuestaVer.poliza_inmueble_info.nombre_inmueble}</strong> — {propuestaVer.poliza_inmueble_info.compania || 'Sin compañía'}
              </div>
            )}

            {/* New table format */}
            {inf.tabla_coberturas && (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-2.5 bg-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider">Cobertura / Riesgo</th>
                      <th className="text-center px-3 py-2.5 bg-green-50 text-green-700 font-semibold text-xs uppercase tracking-wider w-36">Cubierto propietario</th>
                      <th className="text-center px-3 py-2.5 bg-blue-50 text-blue-700 font-semibold text-xs uppercase tracking-wider w-36">Contratar inquilino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inf.tabla_coberturas.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 text-gray-700 text-sm">{row.concepto}</td>
                        <td className="text-center px-3 py-2">{row.propietario ? <span className="text-green-600 font-bold">Si</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="text-center px-3 py-2">{row.inquilino ? <span className="text-blue-600 font-bold">Si</span> : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Old format fallback */}
            {!inf.tabla_coberturas && inf.resumen_poliza_propietario && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Tu póliza cubre al inquilino</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">{inf.resumen_poliza_propietario}</p>
              </div>
            )}
            {!inf.tabla_coberturas && inf.huecos_cobertura && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Huecos de cobertura</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">{inf.huecos_cobertura}</p>
              </div>
            )}
            {!inf.tabla_coberturas && inf.poliza_optima && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Póliza óptima recomendada</h4>
                {inf.poliza_optima.coberturas_imprescindibles && (
                  <div><span className="text-xs font-medium text-gray-500">Coberturas imprescindibles:</span><p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{inf.poliza_optima.coberturas_imprescindibles}</p></div>
                )}
                {inf.poliza_optima.coberturas_recomendables && (
                  <div><span className="text-xs font-medium text-gray-500">Coberturas recomendables:</span><p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{inf.poliza_optima.coberturas_recomendables}</p></div>
                )}
              </div>
            )}
            {!inf.tabla_coberturas && inf.riesgos_sin_cubrir && (
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">Riesgos sin cubrir</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">{inf.riesgos_sin_cubrir}</p>
              </div>
            )}

            {/* Type + Summary (both formats) */}
            {(inf.tipo_recomendado || inf.poliza_optima?.tipo_recomendado) && (
              <div className="flex items-center gap-2">
                <Target size={16} className="text-amber-600" />
                <span className="text-sm font-semibold text-gray-800">{inf.tipo_recomendado || inf.poliza_optima.tipo_recomendado}</span>
              </div>
            )}
            {inf.resumen && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-line">{inf.resumen}</p>
              </div>
            )}
            {!inf.resumen && inf.consejos_adicionales && (
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">Consejos</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">{inf.consejos_adicionales}</p>
              </div>
            )}

            {/* Price (both formats) */}
            {(inf.precio_orientativo || inf.poliza_optima?.precio_orientativo) && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Euro size={16} className="text-green-600" />
                <span className="text-sm font-bold text-green-700">{inf.precio_orientativo || inf.poliza_optima.precio_orientativo}</span>
              </div>
            )}

            {/* Companies (both formats) */}
            {inf.companias_recomendadas && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500">Compañías recomendadas:</span>
                {inf.companias_recomendadas.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700">
                    <Shield size={13} className="text-blue-500 flex-shrink-0" /> {c}
                  </div>
                ))}
              </div>
            )}
            {!inf.companias_recomendadas && inf.poliza_optima?.companias_sugeridas && (
              <div><span className="text-xs font-medium text-gray-500">Compañías sugeridas:</span><p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{inf.poliza_optima.companias_sugeridas}</p></div>
            )}

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => descargarPdfPropuesta(propuestaVer)} className="btn-secundario flex items-center justify-center gap-2">
                <Download size={14} /> PDF
              </button>
              <button onClick={() => { contratarDesdePropuesta(propuestaVer); setPropuestaVer(null); }} className="btn-primario flex-1 justify-center">
                <Plus size={14} /> Contratar esta póliza
              </button>
              <button onClick={() => setPropuestaVer(null)} className="btn-secundario flex-1 justify-center">Cerrar</button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* Modal confirmar eliminación propuesta */}
      <Modal abierto={!!confirmandoEliminarPropuesta} onCerrar={() => setConfirmandoEliminarPropuesta(null)} titulo="Eliminar propuesta" ancho="max-w-sm">
        <p className="text-gray-600 text-sm mb-6">
          ¿Eliminar esta propuesta{confirmandoEliminarPropuesta?.nombre_inquilino ? ` de ${confirmandoEliminarPropuesta.nombre_inquilino}` : ''}?
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmandoEliminarPropuesta(null)} className="btn-secundario flex-1">Cancelar</button>
          <button onClick={() => handleEliminarPropuesta(confirmandoEliminarPropuesta.id)} className="btn-peligro flex-1 justify-center">Eliminar</button>
        </div>
      </Modal>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  );
}
