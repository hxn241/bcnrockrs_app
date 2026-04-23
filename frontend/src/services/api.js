import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authService = {
  register: (username, email, password, fullName) =>
    api.post('/auth/register', { username, email, password, full_name: fullName }),

  login: (username, password) =>
    api.post('/auth/login', { username, password })
}

export const rutasService = {
  getAllRoutes: () => api.get('/rutas'),
  getRoute: (id) => api.get(`/rutas/${id}`),
  createRoute: (ruta) => api.post('/rutas', ruta),
  updateRoute: (id, ruta) => api.put(`/rutas/${id}`, ruta),
  deleteRoute: (id) => api.delete(`/rutas/${id}`)
}

export const rutasPublicadasService = {
  getPublishedRoutes: () => api.get('/rutas-publicadas'),
  getRoutesByDate: (fecha) => api.get(`/rutas-publicadas/calendario/${fecha}`),
  publishRoute: (ruta) => api.post('/rutas-publicadas', ruta),
  addAttendee: (rutaId) => api.post(`/rutas-publicadas/${rutaId}/asistentes`),
  removeAttendee: (rutaId) => api.delete(`/rutas-publicadas/${rutaId}/asistentes`),
  unpublishRoute: (rutaId) => api.delete(`/rutas-publicadas/${rutaId}`),
  updateRoute: (rutaId, updateData) => api.put(`/rutas-publicadas/${rutaId}`, updateData)
}

export default api
