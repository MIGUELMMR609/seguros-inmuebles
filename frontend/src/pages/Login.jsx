import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { iniciarSesion } = useAuth();

  const [formulario, setFormulario] = useState({ email: '', password: '' });
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  function handleCambio(e) {
    setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formulario.email || !formulario.password) {
      setError('Por favor, completa todos los campos');
      return;
    }

    setCargando(true);
    setError('');

    try {
      await iniciarSesion(formulario.email, formulario.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión. Comprueba tus credenciales.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#152740] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <ShieldCheck className="text-orange-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">Gestión de Seguros</h1>
          <p className="text-white/60 mt-2 text-sm">Pólizas de Inmuebles e Inquilinos</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="etiqueta-formulario" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formulario.email}
                onChange={handleCambio}
                placeholder="admin@seguros.com"
                className="campo-formulario"
              />
            </div>

            <div>
              <label className="etiqueta-formulario" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formulario.password}
                  onChange={handleCambio}
                  placeholder="••••••••"
                  className="campo-formulario pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-[#1e3a5f] hover:bg-[#152740] text-white font-semibold py-3 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {cargando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Credenciales por defecto: admin@seguros.com / Admin1234!
        </p>
      </div>
    </div>
  );
}
