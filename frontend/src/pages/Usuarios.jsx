import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserCog, Shield, User } from 'lucide-react';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import {
  obtenerUsuariosApi,
  crearUsuarioApi,
  actualizarUsuarioApi,
  eliminarUsuarioApi,
} from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

const formularioVacio = {
  nombre: '',
  email: '',
  password: '',
  rol: 'usuario',
};

export default function Usuarios() {
  const { usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  async function cargar() {
    try {
      const res = await obtenerUsuariosApi();
      setUsuarios(res.data);
    } catch {
      setError('Error al cargar los usuarios');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setEditando(null);
    setFormulario(formularioVacio);
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(usuario) {
    setEditando(usuario);
    setFormulario({
      nombre: usuario.nombre || '',
      email: usuario.email || '',
      password: '',
      rol: usuario.rol || 'usuario',
    });
    setError('');
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setError('');
  }

  function handleCambio(e) {
    setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!formulario.nombre.trim() || !formulario.email.trim()) {
      setError('Nombre y email son requeridos');
      return;
    }
    if (!editando && !formulario.password) {
      setError('La contraseña es requerida para nuevos usuarios');
      return;
    }
    if (formulario.password && formulario.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const datos = { ...formulario };
      if (editando && !datos.password) delete datos.password;

      if (editando) {
        await actualizarUsuarioApi(editando.id, datos);
      } else {
        await crearUsuarioApi(datos);
      }
      await cargar();
      cerrarModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el usuario');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    try {
      await eliminarUsuarioApi(id);
      setConfirmandoEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el usuario');
    }
  }

  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Nombre',
      render: (f) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1e3a5f] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{f.nombre.charAt(0).toUpperCase()}</span>
          </div>
          <span className="font-medium">{f.nombre}</span>
          {f.id === usuarioActual?.id && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Tú</span>
          )}
        </div>
      ),
    },
    { clave: 'email', titulo: 'Email', render: (f) => <span className="text-gray-600">{f.email}</span> },
    {
      clave: 'rol',
      titulo: 'Rol',
      render: (f) => (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
          f.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {f.rol === 'admin' ? <Shield size={11} /> : <User size={11} />}
          {f.rol === 'admin' ? 'Administrador' : 'Usuario'}
        </span>
      ),
    },
    {
      clave: 'created_at',
      titulo: 'Alta',
      render: (f) => new Date(f.created_at).toLocaleDateString('es-ES'),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '120px',
      render: (f) => (
        <div className="flex items-center gap-2">
          <button onClick={() => abrirEditar(f)} title="Editar" className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
            <Pencil size={20} />
          </button>
          {f.id !== usuarioActual?.id && (
            <button onClick={() => setConfirmandoEliminar(f)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={20} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog size={24} className="text-[#1e3a5f]" />
            Gestión de Usuarios
          </h1>
          <p className="text-gray-500 text-sm mt-1">{usuarios.length} usuarios registrados</p>
        </div>
        <button onClick={abrirCrear} className="btn-primario">
          <Plus size={16} /> Añadir usuario
        </button>
      </div>

      <div className="tarjeta">
        <Tabla columnas={columnas} datos={usuarios} cargando={cargando} mensajeVacio="No hay usuarios registrados." filasPorPagina={9999} />
      </div>

      {/* Modal alta/edición */}
      <Modal abierto={modalAbierto} onCerrar={cerrarModal} titulo={editando ? 'Editar usuario' : 'Nuevo usuario'}>
        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="etiqueta-formulario">Nombre completo *</label>
            <input name="nombre" value={formulario.nombre} onChange={handleCambio} className="campo-formulario" placeholder="María García" />
          </div>
          <div>
            <label className="etiqueta-formulario">Email *</label>
            <input type="email" name="email" value={formulario.email} onChange={handleCambio} className="campo-formulario" placeholder="maria@empresa.com" />
          </div>
          <div>
            <label className="etiqueta-formulario">
              {editando ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
            </label>
            <input
              type="password"
              name="password"
              value={formulario.password}
              onChange={handleCambio}
              className="campo-formulario"
              placeholder={editando ? 'Mínimo 8 caracteres...' : 'Mínimo 8 caracteres'}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="etiqueta-formulario">Rol</label>
            <select name="rol" value={formulario.rol} onChange={handleCambio} className="campo-formulario">
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Los administradores pueden gestionar usuarios y tienen acceso completo.
            </p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={cerrarModal} className="btn-secundario flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primario flex-1 justify-center">
              {guardando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : editando ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal abierto={!!confirmandoEliminar} onCerrar={() => setConfirmandoEliminar(null)} titulo="Confirmar eliminación" ancho="max-w-sm">
        <p className="text-gray-600 text-sm mb-6">
          ¿Eliminar al usuario <strong>{confirmandoEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmandoEliminar(null)} className="btn-secundario flex-1">Cancelar</button>
          <button onClick={() => handleEliminar(confirmandoEliminar.id)} className="btn-peligro flex-1 justify-center">Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}
