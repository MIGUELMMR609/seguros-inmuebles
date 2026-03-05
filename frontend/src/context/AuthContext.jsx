import { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, logoutApi } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario');
    const token = localStorage.getItem('token');
    if (usuarioGuardado && token) {
      try {
        setUsuario(JSON.parse(usuarioGuardado));
      } catch {
        localStorage.removeItem('usuario');
        localStorage.removeItem('token');
      }
    }
    setCargando(false);
  }, []);

  async function iniciarSesion(email, password) {
    const respuesta = await loginApi({ email, password });
    const { token, usuario: datosUsuario } = respuesta.data;
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
    return datosUsuario;
  }

  async function cerrarSesion() {
    try {
      await logoutApi();
    } catch {
      // Ignorar errores al cerrar sesión
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      setUsuario(null);
    }
  }

  const valor = {
    usuario,
    cargando,
    iniciarSesion,
    cerrarSesion,
    esAdmin: usuario?.rol === 'admin',
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return contexto;
}
