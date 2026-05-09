import axios from 'axios'
import { getApiBaseUrl } from '../utils/apiBaseUrl'

// ──────────────────────────────────────────────
// createApiClient — (antes en @bcnrockrs/shared)
// ──────────────────────────────────────────────
function createApiClient({ baseURL, getToken }) {
  const api = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' }
  })

  api.interceptors.request.use((config) => {
    const token = typeof getToken === 'function' ? getToken() : null
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  })

  return api
}

// ──────────────────────────────────────────────
// createServices — (antes en @bcnrockrs/shared)
// ──────────────────────────────────────────────
function listadoSalidasConfig(filters) {
  if (!filters || typeof filters !== 'object') return undefined
  const params = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && String(v).trim() !== '') params[k] = String(v).trim()
  }
  return Object.keys(params).length ? { params } : undefined
}

function createServices(api) {
  const authService = {
    register: (username, email, password, fullName, motoMarca, motoModelo, motoAnio) =>
      api.post('/auth/register', {
        username,
        email,
        password,
        full_name: fullName,
        moto_marca: motoMarca || null,
        moto_modelo: motoModelo || null,
        moto_anio: motoAnio ?? null
      }),

    login: (username, password) => api.post('/auth/login', { username, password }),

    getMe: () => api.get('/auth/me'),

    updateMe: (body) => api.patch('/auth/me', body),

    uploadAvatar: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/auth/me/avatar', fd)
    },

    deleteAvatar: () => api.delete('/auth/me/avatar')
  }

  const rutasService = {
    getAllRoutes: () => api.get('/rutas'),
    getRoutesForPublish: (filters) =>
      api.get('/rutas/para-publicar', listadoSalidasConfig(filters)),
    createRoute: (ruta) => api.post('/rutas', ruta),
    updateRoute: (id, ruta) => api.put(`/rutas/${id}`, ruta),
    deleteRoute: (id) => api.delete(`/rutas/${id}`),
    marcarEliminacionCatalogo: (id) => api.post(`/rutas/${id}/marcar-eliminacion`),
    desmarcarEliminacionCatalogo: (id) => api.delete(`/rutas/${id}/marcar-eliminacion`)
  }

  const rutasPublicadasService = {
    getPublishedRoutes: (filters) => api.get('/rutas-publicadas', listadoSalidasConfig(filters)),
    getHistoricoRoutes: (filters) =>
      api.get('/rutas-publicadas/historico', listadoSalidasConfig(filters)),
    getRoutesByDate: (fecha) => api.get(`/rutas-publicadas/calendario/${fecha}`),
    publishRoute: (ruta) => api.post('/rutas-publicadas', ruta),
    addAttendee: (rutaId) => api.post(`/rutas-publicadas/${rutaId}/asistentes`),
    removeAttendee: (rutaId) => api.delete(`/rutas-publicadas/${rutaId}/asistentes`),
    unpublishRoute: (rutaId) => api.delete(`/rutas-publicadas/${rutaId}`),
    updateRoute: (rutaId, updateData) => api.put(`/rutas-publicadas/${rutaId}`, updateData),
    getFotos: (rutaId) => api.get(`/rutas-publicadas/${rutaId}/fotos`),
    uploadFoto: (rutaId, file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post(`/rutas-publicadas/${rutaId}/fotos`, fd)
    },
    deleteFoto: (rutaId, fotoId) =>
      api.delete(`/rutas-publicadas/${rutaId}/fotos/${fotoId}`)
  }

  const gruposService = {
    listar: () => api.get('/grupos'),
    misGrupos: () => api.get('/grupos/mios'),
    misSolicitudesPendientesIds: () => api.get('/grupos/solicitudes-pendientes/mias'),
    crear: (body) => api.post('/grupos', body),
    detalle: (grupoId) => api.get(`/grupos/${grupoId}/detalle`),
    solicitar: (grupoId) => api.post(`/grupos/${grupoId}/solicitar`),
    cancelarSolicitud: (grupoId) => api.delete(`/grupos/${grupoId}/solicitar`),
    aceptarSolicitud: (grupoId, userId) =>
      api.post(`/grupos/${grupoId}/solicitudes/${userId}/aceptar`),
    rechazarSolicitud: (grupoId, userId) =>
      api.post(`/grupos/${grupoId}/solicitudes/${userId}/rechazar`),
    salir: (grupoId) => api.delete(`/grupos/${grupoId}/salir`),
    expulsarMiembro: (grupoId, userId) =>
      api.delete(`/grupos/${grupoId}/miembros/${userId}`),
    eliminar: (grupoId) => api.delete(`/grupos/${grupoId}`),
    uploadLogo: (grupoId, file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post(`/grupos/${grupoId}/logo`, fd)
    },
    deleteLogo: (grupoId) => api.delete(`/grupos/${grupoId}/logo`)
  }

  return { authService, rutasService, rutasPublicadasService, gruposService }
}

// ──────────────────────────────────────────────
// Instancia y servicios
// ──────────────────────────────────────────────
const api = createApiClient({
  baseURL: getApiBaseUrl(),
  getToken: () => localStorage.getItem('token')
})

const { authService, rutasService, rutasPublicadasService, gruposService } = createServices(api)

export { authService, rutasService, rutasPublicadasService, gruposService }
export default api
