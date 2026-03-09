import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, Bell, Users, AlertTriangle, AlertOctagon, CalendarClock } from 'lucide-react';
import {
  obtenerInmueblesApi,
  obtenerPolizasApi,
  obtenerInquilinosApi,
  obtenerAlertasApi,
  obtenerSiniestrosApi,
} from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

function calcularDiasRestantes(fecha) {
  return Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24));
}

function calcularEstadoPoliza(fechaVencimiento) {
  if (!fechaVencimiento) return { etiqueta: 'Sin fecha', color: 'gray' };
  const dias = calcularDiasRestantes(fechaVencimiento);
  if (dias < 0) return { etiqueta: 'Vencida', color: 'red' };
  if (dias <= 30) return { etiqueta: `${dias}d`, color: 'orange' };
  return { etiqueta: 'Vigente', color: 'green' };
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState({
    inmuebles: [],
    polizas: [],
    inquilinos: [],
    alertas: [],
    polizasVencidas: [],
    contratosVencidos: [],
    totalAlertas: 0,
    hayUrgentes: false,
    siniestrosAbiertos: 0,
    contratosProximos: [],
    contratosVencidosList: [],
    cargando: true,
  });

  useEffect(() => {
    async function cargar() {
      try {
        const [resInmuebles, resPolizas, resInquilinos, resAlertas, resSiniestros] = await Promise.all([
          obtenerInmueblesApi(),
          obtenerPolizasApi(),
          obtenerInquilinosApi(),
          obtenerAlertasApi(30),
          obtenerSiniestrosApi({ estado: 'abierto' }),
        ]);

        // Inquilinos con contrato próximo a vencer (≤30 días o ≤150 para pisos)
        const contratosProximos = resInquilinos.data.filter((inq) => {
          if (!inq.fecha_fin_contrato) return false;
          const dias = calcularDiasRestantes(inq.fecha_fin_contrato);
          const umbral = inq.tipo_inmueble && inq.tipo_inmueble.toLowerCase() === 'piso' ? 150 : 30;
          return dias >= 0 && dias <= umbral;
        });

        // Contratos vencidos + próximos, ordenados por urgencia
        const contratosAlerta = resInquilinos.data
          .filter((inq) => inq.fecha_fin_contrato)
          .map((inq) => ({ ...inq, dias: calcularDiasRestantes(inq.fecha_fin_contrato) }))
          .filter((inq) => {
            const umbral = inq.tipo_inmueble && inq.tipo_inmueble.toLowerCase() === 'piso' ? 150 : 30;
            return inq.dias <= umbral;
          })
          .sort((a, b) => a.dias - b.dias);

        setDatos({
          inmuebles: resInmuebles.data,
          polizas: resPolizas.data,
          inquilinos: resInquilinos.data,
          alertas: resAlertas.data.alertas,
          polizasVencidas: resAlertas.data.polizas_vencidas || [],
          contratosVencidos: resAlertas.data.contratos_vencidos || [],
          totalAlertas: resAlertas.data.total,
          hayUrgentes: resAlertas.data.hay_urgentes || false,
          siniestrosAbiertos: resSiniestros.data.length,
          contratosProximos,
          contratosAlerta,
          cargando: false,
        });
      } catch {
        setDatos((prev) => ({ ...prev, cargando: false }));
      }
    }
    cargar();
  }, []);

  const { inmuebles, polizas, inquilinos, alertas, polizasVencidas, contratosVencidos, totalAlertas, hayUrgentes, siniestrosAbiertos, contratosProximos, contratosAlerta = [], cargando } = datos;

  const tarjetasResumen = [
    {
      titulo: 'Inmuebles',
      valor: inmuebles.length,
      icono: Building2,
      color: 'text-blue-600',
      fondo: 'bg-blue-50',
      ruta: '/inmuebles',
    },
    {
      titulo: 'Pólizas Inmuebles',
      valor: polizas.length,
      icono: FileText,
      color: 'text-indigo-600',
      fondo: 'bg-indigo-50',
      ruta: '/polizas',
    },
    {
      titulo: 'Inquilinos',
      valor: inquilinos.length,
      icono: Users,
      color: 'text-emerald-600',
      fondo: 'bg-emerald-50',
      ruta: '/inquilinos',
    },
    {
      titulo: 'Alertas Activas',
      valor: totalAlertas,
      icono: Bell,
      color: 'text-orange-600',
      fondo: 'bg-orange-50',
      ruta: '/alertas',
      esAlerta: totalAlertas > 0,
      urgente: hayUrgentes,
    },
    ...(siniestrosAbiertos > 0 ? [{
      titulo: 'Siniestros abiertos',
      valor: siniestrosAbiertos,
      icono: AlertOctagon,
      color: 'text-red-600',
      fondo: 'bg-red-50',
      ruta: '/siniestros?estado=abierto',
      esSiniestro: true,
    }] : []),
  ];

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Cabecera */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {usuario?.nombre?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Resumen general de tu cartera de seguros</p>
      </div>

      {/* Tarjetas de resumen */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${siniestrosAbiertos > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-5 mb-6`}>
        {tarjetasResumen.map(({ titulo, valor, icono: Icono, color, fondo, ruta, esAlerta, esSiniestro, urgente }) => (
          <Link
            key={titulo}
            to={ruta}
            className={`tarjeta hover:shadow-md transition-shadow cursor-pointer ${
              esAlerta ? 'ring-2 ring-orange-200' : esSiniestro ? 'ring-2 ring-red-200' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{titulo}</p>
                <p className={`text-3xl font-bold mt-1 ${esAlerta ? 'text-orange-600' : esSiniestro ? 'text-red-600' : 'text-gray-900'}`}>
                  {valor}
                </p>
              </div>
              <div className={`w-12 h-12 ${fondo} rounded-xl flex items-center justify-center`}>
                <Icono className={color} size={22} />
              </div>
            </div>
            {esAlerta && (
              <div className="flex items-center gap-1 mt-3 text-orange-600 text-xs font-medium">
                <AlertTriangle size={12} className={urgente ? 'animate-pulse' : ''} />
                <span>{urgente ? '¡Atención urgente!' : 'Requieren atención'}</span>
              </div>
            )}
            {esSiniestro && (
              <div className="flex items-center gap-1 mt-3 text-red-600 text-xs font-medium">
                <AlertOctagon size={12} />
                <span>Requieren atención</span>
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contratos próximos a vencer */}
        {contratosProximos.length > 0 && (
          <div className="tarjeta">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <CalendarClock size={16} className="text-red-500" />
                Contratos próximos a vencer
              </h2>
              <Link to="/inquilinos" className="text-sm text-[#1e3a5f] font-medium hover:underline">
                Ver inquilinos →
              </Link>
            </div>
            <div className="space-y-3">
              {contratosProximos.slice(0, 5).map((inq) => {
                const dias = calcularDiasRestantes(inq.fecha_fin_contrato);
                return (
                  <div
                    key={inq.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      dias <= 7 ? 'bg-red-50 border border-red-100' : 'bg-orange-50 border border-orange-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                        <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wide">
                          {inq.nombre_inmueble || 'Sin inmueble'}
                        </span>
                        {inq.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        Vence {new Date(inq.fecha_fin_contrato).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <span className={`ml-3 flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                      dias <= 7 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {dias}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pólizas vencidas + próximas a vencer */}
        {(polizasVencidas.length > 0 || alertas.length > 0) && (
          <div className="tarjeta">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Bell size={16} className="text-orange-500" />
                Pólizas — vencidas y próximas
              </h2>
              <Link to="/alertas" className="text-sm text-[#1e3a5f] font-medium hover:underline">
                Ver todas →
              </Link>
            </div>
            <div className="space-y-3">
              {polizasVencidas.slice(0, 3).map((p, i) => (
                <div key={`venc-${p.origen}-${p.id}-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                      <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-wide">
                        Vencida
                      </span>
                      {p.nombre_referencia}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.nombre_inmueble && p.nombre_inmueble !== p.nombre_referencia && `${p.nombre_inmueble} · `}
                      {p.compania_aseguradora || 'Sin compañía'} · Venció {new Date(p.fecha_vencimiento).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <span className="ml-3 flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-red-600 text-white">
                    VENCIDA
                  </span>
                </div>
              ))}
              {alertas.slice(0, 5 - Math.min(polizasVencidas.length, 3)).map((alerta, i) => {
                const dias = parseInt(alerta.dias_restantes);
                const esUrgente = dias <= 7;
                const esInquilino = alerta.origen === 'inquilino';
                return (
                  <div
                    key={`${alerta.origen}-${alerta.id}-${i}`}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      esUrgente ? 'bg-red-50 border border-red-100' : 'bg-orange-50 border border-orange-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                        {esInquilino ? (
                          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase tracking-wide">
                            Inquilino
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wide">
                            Inmueble
                          </span>
                        )}
                        {alerta.nombre_referencia}
                      </p>
                      <p className="text-xs text-gray-500">
                        {esInquilino && alerta.nombre_inmueble && `${alerta.nombre_inmueble} · `}
                        {alerta.compania_aseguradora || 'Sin compañía'} · {alerta.numero_poliza || 'Sin nº'}
                      </p>
                    </div>
                    <span className={`ml-3 flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                      esUrgente ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {dias}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contratos vencidos y próximos */}
        <div className="tarjeta">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CalendarClock size={16} className="text-orange-500" />
              Contratos — vencidos y próximos
            </h2>
            <Link to="/inquilinos" className="text-sm text-[#1e3a5f] font-medium hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="space-y-3">
            {contratosAlerta.slice(0, 5).map((inq) => {
              const vencido = inq.dias < 0;
              const esUrgente = inq.dias <= 7;
              return (
                <div
                  key={inq.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    vencido
                      ? 'bg-red-50 border border-red-200'
                      : esUrgente
                      ? 'bg-red-50 border border-red-100'
                      : 'bg-orange-50 border border-orange-100'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                      <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wide">
                        {inq.nombre_inmueble || 'Sin inmueble'}
                      </span>
                      {inq.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      Fin contrato: {new Date(inq.fecha_fin_contrato).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  {vencido ? (
                    <span className="ml-3 flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-red-600 text-white">
                      VENCIDO
                    </span>
                  ) : (
                    <span className={`ml-3 flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                      esUrgente ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {inq.dias === 0 ? 'HOY' : `VENCE EN ${inq.dias}d`}
                    </span>
                  )}
                </div>
              );
            })}
            {contratosAlerta.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No hay contratos vencidos ni próximos a vencer</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
