import { useEffect, useState } from 'react';
import { Mail, CheckCircle, XCircle, Filter } from 'lucide-react';
import { obtenerRegistroEmailsApi } from '../api/index.js';

const TIPOS = [
  { valor: '', etiqueta: 'Todos los tipos' },
  { valor: 'alerta_vencimiento', etiqueta: 'Alerta vencimiento' },
  { valor: 'aviso_renovacion_inquilino', etiqueta: 'Aviso renovación inquilino' },
  { valor: 'inquilino_sin_seguro', etiqueta: 'Inquilino sin seguro' },
];

const ESTADOS = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'enviado', etiqueta: 'Enviado' },
  { valor: 'error', etiqueta: 'Error' },
];

const DESTINATARIOS = [
  { valor: '', etiqueta: 'Todos los destinatarios' },
  { valor: 'admin', etiqueta: 'Administrador' },
  { valor: 'inquilino', etiqueta: 'Inquilino' },
];

function etiquetaTipo(tipo) {
  const encontrado = TIPOS.find((t) => t.valor === tipo);
  return encontrado?.etiqueta || tipo;
}

export default function RegistroEmails() {
  const [emails, setEmails] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState({
    tipo: '',
    destinatario_tipo: '',
    estado: '',
    fecha_desde: '',
    fecha_hasta: '',
  });

  async function cargar() {
    setCargando(true);
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''));
      const res = await obtenerRegistroEmailsApi(params);
      setEmails(res.data);
    } catch {
      setEmails([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [filtros]);

  function handleFiltro(e) {
    setFiltros((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail size={24} className="text-[#1e3a5f]" />
            Emails enviados
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Historial de correos enviados automáticamente por el sistema
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="tarjeta mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtros</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select name="tipo" value={filtros.tipo} onChange={handleFiltro} className="campo-formulario">
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </select>
          <select name="destinatario_tipo" value={filtros.destinatario_tipo} onChange={handleFiltro} className="campo-formulario">
            {DESTINATARIOS.map((d) => <option key={d.valor} value={d.valor}>{d.etiqueta}</option>)}
          </select>
          <select name="estado" value={filtros.estado} onChange={handleFiltro} className="campo-formulario">
            {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
          </select>
          <div>
            <input
              type="date"
              name="fecha_desde"
              value={filtros.fecha_desde}
              onChange={handleFiltro}
              className="campo-formulario"
              placeholder="Desde"
            />
          </div>
          <div>
            <input
              type="date"
              name="fecha_hasta"
              value={filtros.fecha_hasta}
              onChange={handleFiltro}
              className="campo-formulario"
              placeholder="Hasta"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="tarjeta overflow-x-auto">
        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Mail size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No hay emails registrados</p>
            <p className="text-gray-400 text-sm mt-1">Los emails se registran automáticamente cuando el cron los envía.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Destinatario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Error</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(email.fecha_envio).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      {etiquetaTipo(email.tipo)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        email.destinatario_tipo === 'admin'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {email.destinatario_tipo === 'admin' ? 'Admin' : 'Inquilino'}
                      </span>
                      {email.nombre_inquilino && (
                        <span className="ml-2 text-gray-700">{email.nombre_inquilino}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                    {email.destinatario_email || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {email.estado === 'enviado' ? (
                      <span className="flex items-center gap-1 text-green-700 text-xs font-medium">
                        <CheckCircle size={14} /> Enviado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-700 text-xs font-medium">
                        <XCircle size={14} /> Error
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-red-600 text-xs max-w-xs truncate">
                    {email.mensaje_error || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
