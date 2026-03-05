import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Building2, FileText, Users, Shield,
  Bell, UserCog, LogOut, ShieldCheck, AlertOctagon, Calculator, Mail, Archive,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { obtenerAlertasApi, obtenerResumenAlertasApi } from '../api/index.js';

const elementosNav = [
  { ruta: '/dashboard', etiqueta: 'Inicio', icono: LayoutDashboard },
  { ruta: '/inmuebles', etiqueta: 'Inmuebles', icono: Building2 },
  { ruta: '/polizas', etiqueta: 'Pólizas Inmuebles', icono: FileText },
  { ruta: '/inquilinos', etiqueta: 'Inquilinos', icono: Users, badgeClave: 'contratos_proximos' },
  { ruta: '/historico-inquilinos', etiqueta: 'Histórico inquilinos', icono: Archive },
  { ruta: '/polizas-inquilinos', etiqueta: 'Pólizas Inquilinos', icono: Shield, badgeClave: 'inquilinos_sin_seguro' },
  { ruta: '/siniestros', etiqueta: 'Siniestros', icono: AlertOctagon },
  { ruta: '/contabilidad', etiqueta: 'Contabilidad', icono: Calculator },
  { ruta: '/alertas', etiqueta: 'Alertas', icono: Bell, esAlerta: true },
  { ruta: '/registro-emails', etiqueta: 'Emails enviados', icono: Mail },
];

export default function Layout() {
  const { usuario, cerrarSesion, esAdmin } = useAuth();
  const navigate = useNavigate();
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [resumen, setResumen] = useState({ contratos_proximos: 0, inquilinos_sin_seguro: 0 });

  useEffect(() => {
    async function cargarAlertas() {
      try {
        const [respAlertas, respResumen] = await Promise.all([
          obtenerAlertasApi(30),
          obtenerResumenAlertasApi(),
        ]);
        setTotalAlertas(respAlertas.data.total);
        setResumen(respResumen.data);
      } catch {
        // Silenciar error de red
      }
    }
    cargarAlertas();
    const intervalo = setInterval(cargarAlertas, 5 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  async function handleCerrarSesion() {
    await cerrarSesion();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Barra lateral */}
      <aside className="w-64 bg-[#1e3a5f] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-orange-400" size={28} />
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Gestión de</h1>
              <h1 className="text-orange-400 font-bold text-base leading-tight">Seguros</h1>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {elementosNav.map(({ ruta, etiqueta, icono: Icono, esAlerta, badgeClave }) => {
            const badgeValor = badgeClave ? resumen[badgeClave] : 0;
            return (
              <NavLink
                key={ruta}
                to={ruta}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icono size={17} />
                <span className="flex-1">{etiqueta}</span>
                {esAlerta && totalAlertas > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {totalAlertas > 99 ? '99+' : totalAlertas}
                  </span>
                )}
                {badgeClave && badgeValor > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {badgeValor > 99 ? '99+' : badgeValor}
                  </span>
                )}
              </NavLink>
            );
          })}

          {esAdmin && (
            <NavLink
              to="/usuarios"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <UserCog size={17} />
              <span>Usuarios</span>
            </NavLink>
          )}
        </nav>

        {/* Perfil y logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-3">
            <div className="w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {usuario?.nombre?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{usuario?.nombre}</p>
              <p className="text-white/50 text-xs truncate">{usuario?.email}</p>
            </div>
          </div>
          <button
            onClick={handleCerrarSesion}
            className="flex items-center gap-2 w-full px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors"
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
