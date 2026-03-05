import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: añadir token JWT a todas las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const loginApi = (datos) => api.post('/auth/login', datos);
export const logoutApi = () => api.post('/auth/logout');
export const obtenerUsuarioActualApi = () => api.get('/auth/yo');

// --- Inmuebles ---
export const obtenerInmueblesApi = () => api.get('/inmuebles');
export const crearInmuebleApi = (datos) => api.post('/inmuebles', datos);
export const actualizarInmuebleApi = (id, datos) => api.put(`/inmuebles/${id}`, datos);
export const eliminarInmuebleApi = (id) => api.delete(`/inmuebles/${id}`);

// --- Pólizas de Inmuebles ---
export const obtenerPolizasApi = (filtros = {}) => api.get('/polizas', { params: filtros });
export const crearPolizaApi = (datos) => api.post('/polizas', datos);
export const actualizarPolizaApi = (id, datos) => api.put(`/polizas/${id}`, datos);
export const eliminarPolizaApi = (id) => api.delete(`/polizas/${id}`);
export const obtenerCoberturasPolizaApi = (id) => api.get(`/polizas/${id}/coberturas`);

// --- Renovaciones ---
export const obtenerHistorialApi = (polizaId) => api.get(`/renovaciones/${polizaId}`);
export const renovarPolizaApi = (polizaId, datos) => api.post(`/renovaciones/${polizaId}`, datos);

// --- Inquilinos ---
export const obtenerInquilinosApi = (filtros = {}) => api.get('/inquilinos', { params: filtros });
export const crearInquilinoApi = (datos) => api.post('/inquilinos', datos);
export const actualizarInquilinoApi = (id, datos) => api.put(`/inquilinos/${id}`, datos);
export const eliminarInquilinoApi = (id) => api.delete(`/inquilinos/${id}`);
export const finalizarInquilinoApi = (id, datos) => api.put(`/inquilinos/${id}/finalizar`, datos);
export const reactivarInquilinoApi = (id) => api.put(`/inquilinos/${id}/reactivar`);
export const renovarContratoApi = (id, datos) => api.post(`/inquilinos/${id}/renovar`, datos);
export const obtenerRenovacionesApi = (id) => api.get(`/inquilinos/${id}/renovaciones`);
export const obtenerHistoricoInquilinosApi = () => api.get('/inquilinos', { params: { historico: 'true' } });
export const generarContratoWordApi = (id) => api.get(`/inquilinos/${id}/contrato-word`, { responseType: 'blob' });

// --- Pólizas de Inquilinos ---
export const obtenerPolizasInquilinosApi = (filtros = {}) =>
  api.get('/polizas-inquilinos', { params: filtros });
export const crearPolizaInquilinoApi = (datos) => api.post('/polizas-inquilinos', datos);
export const actualizarPolizaInquilinoApi = (id, datos) =>
  api.put(`/polizas-inquilinos/${id}`, datos);
export const eliminarPolizaInquilinoApi = (id) => api.delete(`/polizas-inquilinos/${id}`);

// --- Alertas ---
export const obtenerAlertasApi = (dias = 30) => api.get('/alertas', { params: { dias } });
export const obtenerResumenAlertasApi = () => api.get('/alertas/resumen');

// --- Usuarios ---
export const obtenerUsuariosApi = () => api.get('/usuarios');
export const crearUsuarioApi = (datos) => api.post('/usuarios', datos);
export const actualizarUsuarioApi = (id, datos) => api.put(`/usuarios/${id}`, datos);
export const eliminarUsuarioApi = (id) => api.delete(`/usuarios/${id}`);

// --- Upload ---
export const subirDocumentoApi = (archivo) => {
  const formData = new FormData();
  formData.append('documento', archivo);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// --- Siniestros ---
export const obtenerSiniestrosApi = (filtros = {}) => api.get('/siniestros', { params: filtros });
export const obtenerSiniestroApi = (id) => api.get(`/siniestros/${id}`);
export const crearSiniestroApi = (datos) => api.post('/siniestros', datos);
export const actualizarSiniestroApi = (id, datos) => api.put(`/siniestros/${id}`, datos);
export const eliminarSiniestroApi = (id) => api.delete(`/siniestros/${id}`);
export const cerrarSiniestroApi = (id) => api.put(`/siniestros/${id}/cerrar`);
export const reabrirSiniestroApi = (id) => api.put(`/siniestros/${id}/reabrir`);
export const añadirLlamadaApi = (id, datos) => api.post(`/siniestros/${id}/llamadas`, datos);
export const eliminarLlamadaApi = (id, indice) => api.delete(`/siniestros/${id}/llamadas/${indice}`);
export const subirFotosSiniestroApi = (id, archivos) => {
  const formData = new FormData();
  archivos.forEach((f) => formData.append('fotos', f));
  return api.post(`/siniestros/${id}/fotos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const eliminarFotoSiniestroApi = (id, indice) =>
  api.delete(`/siniestros/${id}/fotos/${indice}`);

// --- Contabilidad ---
export const obtenerContabilidadApi = (year) => api.get('/contabilidad', { params: { year } });

// --- Registro de emails ---
export const obtenerRegistroEmailsApi = (filtros = {}) => api.get('/registro-emails', { params: filtros });

// --- Analizar PDF con IA ---
export const analizarPdfApi = (archivo) => {
  const formData = new FormData();
  formData.append('documento', archivo);
  return api.post('/analizar-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const analizarContratoApi = (archivo) => {
  const formData = new FormData();
  formData.append('documento', archivo);
  return api.post('/analizar-contrato', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export default api;
