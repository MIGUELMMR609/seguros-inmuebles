import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Building2, FileText, Users, Shield,
  Bell, UserCog, LogOut, ShieldCheck, AlertOctagon, Calculator, Mail, Archive,
  Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { obtenerAlertasApi, obtenerResumenAlertasApi } from '../api/index.js';

const elementosNav = [
  { ruta: '/dashboard', etiqueta: 'Inicio', icono: LayoutDashboard },
  {
    ruta: '/inmuebles', etiqueta: 'Inmuebles', icono: Building2,
    badgeClave: 'inmuebles_sin_poliza',
    badgeTooltip: (n) => `${n} inmueble${n !== 1 ? 's' : ''} sin póliza asignada`,
  },
  { ruta: '/polizas', etiqueta: 'Pólizas Inmuebles', icono: FileText },
  {
    ruta: '/inquilinos', etiqueta: 'Inquilinos', icono: Users,
    badgeClave: 'contratos_proximos',
    badgeTooltip: (n) => `${n} contrato${n !== 1 ? 's' : ''} próximo${n !== 1 ? 's' : ''} a vencer`,
  },
  { ruta: '/historico-inquilinos', etiqueta: 'Histórico inquilinos', icono: Archive },
  {
    ruta: '/polizas-inquilinos', etiqueta: 'Pólizas Inquilinos', icono: Shield,
    badgeClave: 'inquilinos_sin_seguro',
    badgeTooltip: (n) => `${n} inquilino${n !== 1 ? 's' : ''} sin póliza activa`,
  },
  { ruta: '/siniestros', etiqueta: 'Siniestros', icono: AlertOctagon },
  { ruta: '/contabilidad', etiqueta: 'Contabilidad', icono: Calculator },
  { ruta: '/alertas', etiqueta: 'Alertas', icono: Bell, esAlerta: true },
  { ruta: '/registro-emails', etiqueta: 'Emails enviados', icono: Mail },
];

export default function Layout() {
  const { usuario, cerrarSesion, esAdmin } = useAuth();
  const navigate = useNavigate();
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [hayUrgentes, setHayUrgentes] = useState(false);
  const [resumen, setResumen] = useState({ contratos_proximos: 0, inquilinos_sin_seguro: 0 });
  const [menuAbierto, setMenuAbierto] = useState(false);

  const cargarAlertas = useCallback(async () => {
    try {
      const [respAlertas, respResumen] = await Promise.all([
        obtenerAlertasApi(30),
        obtenerResumenAlertasApi(),
      ]);
      setTotalAlertas(respAlertas.data.total);
      setHayUrgentes(respAlertas.data.hay_urgentes || false);
      setResumen(respResumen.data);
    } catch {
      // Silenciar error de red
    }
  }, []);

  useEffect(() => {
    cargarAlertas();
    const intervalo = setInterval(cargarAlertas, 30_000);
    window.addEventListener('refreshBadges', cargarAlertas);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('refreshBadges', cargarAlertas);
    };
  }, [cargarAlertas]);

  // Cerrar menú al cambiar ruta en móvil
  function handleNavClick() {
    setMenuAbierto(false);
  }

  async function handleCerrarSesion() {
    await cerrarSesion();
    navigate('/login');
  }

  const contenidoSidebar = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-orange-400 flex-shrink-0" size={28} />
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Gestión de</h1>
            <h1 className="text-orange-400 font-bold text-base leading-tight">Seguros</h1>
          </div>
        </div>
        {/* Botón cerrar en móvil */}
        <button
          className="md:hidden text-white/70 hover:text-white p-1"
          onClick={() => setMenuAbierto(false)}
        >
          <X size={22} />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {elementosNav.map(({ ruta, etiqueta, icono: Icono, esAlerta, badgeClave, badgeTooltip }) => {
          const badgeValor = badgeClave ? (resumen[badgeClave] || 0) : 0;
          return (
            <NavLink
              key={ruta}
              to={ruta}
              onClick={handleNavClick}
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
                <span
                  title={`${totalAlertas} alerta${totalAlertas !== 1 ? 's' : ''} pendiente${totalAlertas !== 1 ? 's' : ''}`}
                  className={`bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center${hayUrgentes ? ' animate-pulse' : ''}`}
                >
                  {totalAlertas > 99 ? '99+' : totalAlertas}
                </span>
              )}
              {badgeClave && badgeValor > 0 && (
                <span
                  title={badgeTooltip ? badgeTooltip(badgeValor) : ''}
                  className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center"
                >
                  {badgeValor > 99 ? '99+' : badgeValor}
                </span>
              )}
            </NavLink>
          );
        })}

        {esAdmin && (
          <NavLink
            to="/usuarios"
            onClick={handleNavClick}
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
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar desktop (siempre visible en md+) */}
      <aside className="hidden md:flex w-64 bg-[#1e3a5f] flex-col flex-shrink-0">
        {contenidoSidebar}
      </aside>

      {/* Overlay móvil */}
      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* Sidebar móvil (drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#1e3a5f] flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out md:hidden ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {contenidoSidebar}
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header móvil */}
        <header className="md:hidden bg-[#1e3a5f] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setMenuAbierto(true)}
            className="text-white p-1.5 rounded-lg hover:bg-white/10 touch-target"
          >
            <Menu size={22} />
          </button>
          <ShieldCheck className="text-orange-400" size={22} />
          <span className="text-white font-bold text-base">Gestión de Seguros</span>
          {totalAlertas > 0 && (
            <span className={`ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full${hayUrgentes ? ' animate-pulse' : ''}`}>
              {totalAlertas > 99 ? '99+' : totalAlertas}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
