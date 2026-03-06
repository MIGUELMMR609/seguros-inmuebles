import { useEffect, useState } from 'react';
import {
  Bell, AlertTriangle, Clock, CheckCircle, Building2, Shield,
  CalendarClock, ShieldOff, XCircle, Users, CalendarX,
} from 'lucide-react';
import { obtenerAlertasApi } from '../api/index.js';

function colorUrgencia(dias) {
  if (dias <= 7) return { fila: 'bg-red-50 border-l-4 border-red-500', badge: 'bg-red-600 text-white', texto: 'text-red-700', icono: <AlertTriangle size={12} /> };
  if (dias <= 15) return { fila: 'bg-orange-50 border-l-4 border-orange-400', badge: 'bg-orange-500 text-white', texto: 'text-orange-700', icono: <Clock size={12} /> };
  return { fila: 'bg-yellow-50 border-l-4 border-yellow-400', badge: 'bg-yellow-500 text-white', texto: 'text-yellow-700', icono: <Bell size={12} /> };
}

function BadgeDias({ dias }) {
  const { badge, icono } = colorUrgencia(dias);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${badge}`}>
      {icono} {dias}d
    </span>
  );
}

function BadgeVencida() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-600 text-white">
      <XCircle size={10} /> VENCIDA
    </span>
  );
}

function FilaVacia() {
  return (
    <div className="flex items-center gap-2 px-4 py-4 text-green-700 bg-green-50 rounded-lg">
      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
      <span className="text-sm font-medium">Todo en orden</span>
    </div>
  );
}

function CabeceraSección({ icono: Icono, titulo, count, color }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className={`text-base font-bold flex items-center gap-2 ${color}`}>
        <Icono size={18} />
        {titulo}
      </h2>
      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
        count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      }`}>
        {count > 0 ? `${count} alerta${count !== 1 ? 's' : ''}` : 'Sin alertas'}
      </span>
    </div>
  );
}

const estadoVacio = {
  polizas_inmuebles: [],
  polizas_inquilinos: [],
  contratos_alquiler: [],
  inmuebles_sin_poliza: [],
  polizas_vencidas: [],
  inquilinos_sin_poliza: [],
  contratos_vencidos: [],
};

export default function Alertas() {
  const [datos, setDatos] = useState(estadoVacio);
  const [cargando, setCargando] = useState(true);
  const [dias, setDias] = useState(30);

  async function cargar() {
    setCargando(true);
    try {
      const res = await obtenerAlertasApi(dias);
      setDatos({
        polizas_inmuebles: res.data.polizas_inmuebles || [],
        polizas_inquilinos: res.data.polizas_inquilinos || [],
        contratos_alquiler: res.data.contratos_alquiler || [],
        inmuebles_sin_poliza: res.data.inmuebles_sin_poliza || [],
        polizas_vencidas: res.data.polizas_vencidas || [],
        inquilinos_sin_poliza: res.data.inquilinos_sin_poliza || [],
        contratos_vencidos: res.data.contratos_vencidos || [],
      });
    } catch {
      setDatos(estadoVacio);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [dias]);

  const totalGeneral =
    datos.polizas_inmuebles.length +
    datos.polizas_inquilinos.length +
    datos.contratos_alquiler.length +
    datos.inmuebles_sin_poliza.length +
    datos.polizas_vencidas.length +
    datos.inquilinos_sin_poliza.length +
    datos.contratos_vencidos.length;

  return (
    <div className="p-4 md:p-8">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell size={24} className="text-orange-500" />
            Alertas de Vencimiento
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {cargando ? 'Cargando...' : totalGeneral > 0
              ? `${totalGeneral} alerta${totalGeneral !== 1 ? 's' : ''} en total`
              : 'Sin alertas activas'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Mostrar los próximos:</label>
          <select value={dias} onChange={(e) => setDias(parseInt(e.target.value))} className="campo-formulario w-auto">
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── SECCIÓN 1: Pólizas Vencidas ── */}
          <div className="tarjeta">
            <CabeceraSección
              icono={XCircle}
              titulo="Pólizas Vencidas"
              count={datos.polizas_vencidas.length}
              color="text-red-700"
            />
            {datos.polizas_vencidas.length === 0 ? <FilaVacia /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Referencia</th>
                      <th className="pb-2 pr-4">Inmueble</th>
                      <th className="pb-2 pr-4">Compañía</th>
                      <th className="pb-2 pr-4">Nº Póliza</th>
                      <th className="pb-2 pr-4">Venció el</th>
                      <th className="pb-2 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.polizas_vencidas.map((p) => (
                      <tr key={`${p.origen}-${p.id}`} className="bg-red-50 border-l-4 border-red-500">
                        <td className="py-3 pr-4 text-gray-600 capitalize">{p.origen === 'inmueble' ? 'Inmueble' : 'Inquilino'}</td>
                        <td className="py-3 pr-4 font-semibold text-gray-900">{p.nombre_referencia || '—'}</td>
                        <td className="py-3 pr-4 text-gray-600">{p.nombre_inmueble || '—'}</td>
                        <td className="py-3 pr-4 text-gray-600">{p.compania_aseguradora || '—'}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-gray-600">{p.numero_poliza || '—'}</td>
                        <td className="py-3 pr-4 font-medium text-red-700">
                          {new Date(p.fecha_vencimiento).toLocaleDateString('es-ES')}
                        </td>
                        <td className="py-3 text-right"><BadgeVencida /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECCIÓN 2: Contratos Vencidos ── */}
          <div className="tarjeta">
            <CabeceraSección
              icono={CalendarX}
              titulo="Contratos de Alquiler Vencidos"
              count={datos.contratos_vencidos.length}
              color="text-red-700"
            />
            {datos.contratos_vencidos.length === 0 ? <FilaVacia /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-4">Inquilino</th>
                      <th className="pb-2 pr-4">Inmueble</th>
                      <th className="pb-2 pr-4">Fin de contrato</th>
                      <th className="pb-2 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.contratos_vencidos.map((c) => (
                      <tr key={c.id} className="bg-red-50 border-l-4 border-red-500">
                        <td className="py-3 pr-4 font-semibold text-gray-900">{c.nombre_inquilino || '—'}</td>
                        <td className="py-3 pr-4 text-gray-600">{c.nombre_inmueble || '—'}</td>
                        <td className="py-3 pr-4 font-medium text-red-700">
                          {new Date(c.fecha_fin_contrato).toLocaleDateString('es-ES')}
                        </td>
                        <td className="py-3 text-right"><BadgeVencida /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECCIÓN 3: Pólizas de Inmuebles próximas ── */}
          <div className="tarjeta">
            <CabeceraSección
              icono={Building2}
              titulo="Pólizas de Inmuebles"
              count={datos.polizas_inmuebles.length}
              color="text-[#1e3a5f]"
            />
            {datos.polizas_inmuebles.length === 0 ? <FilaVacia /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-4">Inmueble</th>
                      <th className="pb-2 pr-4">Compañía</th>
                      <th className="pb-2 pr-4">Nº Póliza</th>
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Vencimiento</th>
                      <th className="pb-2 text-right">Días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.polizas_inmuebles.map((p) => {
                      const { fila, texto } = colorUrgencia(p.dias_restantes);
                      return (
                        <tr key={p.id} className={fila}>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{p.nombre_inmueble || '—'}</td>
                          <td className="py-3 pr-4 text-gray-600">{p.compania_aseguradora || '—'}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-gray-600">{p.numero_poliza || '—'}</td>
                          <td className="py-3 pr-4 text-gray-600 capitalize">{(p.tipo || '').replace(/_/g, ' ')}</td>
                          <td className={`py-3 pr-4 font-medium ${texto}`}>
                            {new Date(p.fecha_vencimiento).toLocaleDateString('es-ES')}
                          </td>
                          <td className="py-3 text-right"><BadgeDias dias={p.dias_restantes} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECCIÓN 4: Pólizas de Inquilinos próximas ── */}
          <div className="tarjeta">
            <CabeceraSección
              icono={Shield}
              titulo="Pólizas de Inquilinos"
              count={datos.polizas_inquilinos.length}
              color="text-indigo-700"
            />
            {datos.polizas_inquilinos.length === 0 ? <FilaVacia /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-4">Inquilino</th>
                      <th className="pb-2 pr-4">Inmueble</th>
                      <th className="pb-2 pr-4">Compañía</th>
                      <th className="pb-2 pr-4">Nº Póliza</th>
                      <th className="pb-2 pr-4">Vencimiento</th>
                      <th className="pb-2 text-right">Días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.polizas_inquilinos.map((p) => {
                      const { fila, texto } = colorUrgencia(p.dias_restantes);
                      return (
                        <tr key={p.id} className={fila}>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{p.nombre_inquilino || '—'}</td>
                          <td className="py-3 pr-4 text-gray-600">{p.nombre_inmueble || '—'}</td>
                          <td className="py-3 pr-4 text-gray-600">{p.compania_aseguradora || '—'}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-gray-600">{p.numero_poliza || '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${texto}`}>
                            {new Date(p.fecha_vencimiento).toLocaleDateString('es-ES')}
                          </td>
                          <td className="py-3 text-right"><BadgeDias dias={p.dias_restantes} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECCIÓN 5: Contratos de Alquiler próximos ── */}
          <div className="tarjeta">
            <CabeceraSección
              icono={CalendarClock}
              titulo="Contratos de Alquiler"
              count={datos.contratos_alquiler.length}
              color="text-emerald-700"
            />
            {datos.contratos_alquiler.length === 0 ? <FilaVacia /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-4">Inquilino</th>
                      <th className="pb-2 pr-4">Inmueble</th>
                      <th className="pb-2 pr-4">Fin de contrato</th>
                      <th className="pb-2 text-right">Días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.contratos_alquiler.map((c) => {
                      const { fila, texto } = colorUrgencia(c.dias_restantes);
                      return (
                        <tr key={c.id} className={fila}>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{c.nombre_inquilino || '—'}</td>
                          <td className="py-3 pr-4 text-gray-600">{c.nombre_inmueble || '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${texto}`}>
                            {new Date(c.fecha_fin_contrato).toLocaleDateString('es-ES')}
                          </td>
                          <td className="py-3 text-right"><BadgeDias dias={c.dias_restantes} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECCIÓN 6: Inmuebles sin póliza ── */}
          <div className="tarjeta">
            <CabeceraSección
              icono={ShieldOff}
              titulo="Inmuebles sin póliza asignada"
              count={datos.inmuebles_sin_poliza.length}
              color="text-orange-700"
            />
            {datos.inmuebles_sin_poliza.length === 0 ? <FilaVacia /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-4">Inmueble</th>
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2">Dirección</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.inmuebles_sin_poliza.map((inm) => (
                      <tr key={inm.id} className="bg-orange-50 border-l-4 border-orange-400">
                        <td className="py-3 pr-4 font-semibold text-gray-900">
                          <span className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
                            {inm.nombre}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 capitalize">{inm.tipo || '—'}</td>
                        <td className="py-3 text-gray-600">{inm.direccion || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECCIÓN 7: Inquilinos sin póliza ── */}
          <div className="tarjeta">
            <CabeceraSección
              icono={Users}
              titulo="Inquilinos sin póliza asignada"
              count={datos.inquilinos_sin_poliza.length}
              color="text-purple-700"
            />
            {datos.inquilinos_sin_poliza.length === 0 ? <FilaVacia /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-4">Inquilino</th>
                      <th className="pb-2 pr-4">Inmueble</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.inquilinos_sin_poliza.map((inq) => (
                      <tr key={inq.id} className="bg-purple-50 border-l-4 border-purple-400">
                        <td className="py-3 pr-4 font-semibold text-gray-900">
                          <span className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-purple-500 flex-shrink-0" />
                            {inq.nombre}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{inq.nombre_inmueble || '—'}</td>
                        <td className="py-3 pr-4 text-gray-600">
                          {inq.email
                            ? <a href={`mailto:${inq.email}`} className="text-[#1e3a5f] hover:underline">{inq.email}</a>
                            : '—'}
                        </td>
                        <td className="py-3 text-gray-600">{inq.telefono || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
