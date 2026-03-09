import { useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { obtenerActividadApi, obtenerUsuariosActividadApi } from '../api/index.js';

const ACCIONES = [
  { valor: '', etiqueta: 'Todas las acciones' },
  { valor: 'login', etiqueta: 'Login' },
  { valor: 'crear', etiqueta: 'Crear' },
  { valor: 'editar', etiqueta: 'Editar' },
  { valor: 'eliminar', etiqueta: 'Eliminar' },
];

const ENTIDADES = [
  { valor: '', etiqueta: 'Todas las entidades' },
  { valor: 'poliza_inmueble', etiqueta: 'Póliza Inmueble' },
  { valor: 'poliza_inquilino', etiqueta: 'Póliza Inquilino' },
  { valor: 'inquilino', etiqueta: 'Inquilino' },
  { valor: 'inmueble', etiqueta: 'Inmueble' },
  { valor: 'usuarios', etiqueta: 'Usuarios (login)' },
];

function badgeAccion(accion) {
  const clases = {
    login: 'bg-blue-100 text-blue-700',
    crear: 'bg-green-100 text-green-700',
    editar: 'bg-yellow-100 text-yellow-700',
    eliminar: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${clases[accion] || 'bg-gray-100 text-gray-600'}`}>{accion}</span>;
}

function formatFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export default function Actividad() {
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [pagina, setPagina] = useState(1);
  const LIMITE = 50;

  const [filtros, setFiltros] = useState({ usuario_id: '', accion: '', entidad: '', desde: '', hasta: '' });

  async function cargar(pag = pagina) {
    setCargando(true);
    try {
      const params = { pagina: pag, limite: LIMITE };
      if (filtros.usuario_id) params.usuario_id = filtros.usuario_id;
      if (filtros.accion) params.accion = filtros.accion;
      if (filtros.entidad) params.entidad = filtros.entidad;
      if (filtros.desde) params.desde = filtros.desde;
      if (filtros.hasta) params.hasta = filtros.hasta;
      const res = await obtenerActividadApi(params);
      setRegistros(res.data.registros);
      setTotal(res.data.total);
    } catch { setRegistros([]); }
    finally { setCargando(false); }
  }

  useEffect(() => { obtenerUsuariosActividadApi().then(r => setUsuarios(r.data)).catch(() => {}); }, []);
  useEffect(() => { cargar(1); setPagina(1); }, [filtros]);
  useEffect(() => { cargar(pagina); }, [pagina]);

  const totalPaginas = Math.ceil(total / LIMITE);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity size={24} className="text-[#1e3a5f]" />
          Registro de actividad
        </h1>
        <p className="text-gray-500 text-sm mt-1">{total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <select value={filtros.usuario_id} onChange={e => setFiltros(f => ({ ...f, usuario_id: e.target.value }))} className="campo-formulario text-sm">
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select value={filtros.accion} onChange={e => setFiltros(f => ({ ...f, accion: e.target.value }))} className="campo-formulario text-sm">
          {ACCIONES.map(a => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
        </select>
        <select value={filtros.entidad} onChange={e => setFiltros(f => ({ ...f, entidad: e.target.value }))} className="campo-formulario text-sm">
          {ENTIDADES.map(e => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
        </select>
        <input type="date" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} className="campo-formulario text-sm" placeholder="Desde" />
        <input type="date" value={filtros.hasta} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} className="campo-formulario text-sm" placeholder="Hasta" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" /></div>
        ) : registros.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Activity size={40} className="mx-auto mb-3 opacity-30" />
            <p>No hay registros de actividad</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entidad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Detalle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registros.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{formatFecha(r.fecha)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#1e3a5f] rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{(r.usuario_nombre || r.usuario_email || '?')[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-xs">{r.usuario_nombre || '—'}</p>
                          <p className="text-gray-400 text-xs">{r.usuario_email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{badgeAccion(r.accion)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{r.entidad || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs max-w-xs truncate" title={r.detalle}>{r.detalle || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{r.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">Página {pagina} de {totalPaginas}</p>
            <div className="flex gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
