import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inmuebles from './pages/Inmuebles.jsx';
import Polizas from './pages/Polizas.jsx';
import Inquilinos from './pages/Inquilinos.jsx';
import PolizasInquilinos from './pages/PolizasInquilinos.jsx';
import Alertas from './pages/Alertas.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Siniestros from './pages/Siniestros.jsx';
import Contabilidad from './pages/Contabilidad.jsx';
import RegistroEmails from './pages/RegistroEmails.jsx';
import HistoricoInquilinos from './pages/HistoricoInquilinos.jsx';
import Backup from './pages/Backup.jsx';
import Actividad from './pages/Actividad.jsx';

function RutaProtegida({ children, soloAdmin = false }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && usuario.rol !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function RutaPublica({ children }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]" />
      </div>
    );
  }

  if (usuario) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={<RutaPublica><Login /></RutaPublica>}
          />
          <Route
            path="/"
            element={<RutaProtegida><Layout /></RutaProtegida>}
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="inmuebles" element={<Inmuebles />} />
            <Route path="polizas" element={<Polizas />} />
            <Route path="inquilinos" element={<Inquilinos />} />
            <Route path="polizas-inquilinos" element={<PolizasInquilinos />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="siniestros" element={<Siniestros />} />
            <Route path="contabilidad" element={<Contabilidad />} />
            <Route path="registro-emails" element={<RegistroEmails />} />
            <Route path="historico-inquilinos" element={<HistoricoInquilinos />} />
            <Route path="backup" element={<Backup />} />
            <Route
              path="usuarios"
              element={<RutaProtegida soloAdmin><Usuarios /></RutaProtegida>}
            />
            <Route
              path="actividad"
              element={<RutaProtegida soloAdmin><Actividad /></RutaProtegida>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
