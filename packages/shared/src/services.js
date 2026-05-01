/**
 * Servicios de API reutilizables. Reciben la instancia axios creada con createApiClient.
 */
export function createServices(api) {
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

    login: (username, password) => api.post('/auth/login', { username, password })
  }

  const rutasService = {
    getAllRoutes: () => api.get('/rutas'),
    getRoutesForPublish: () => api.get('/rutas/para-publicar'),
    getRoute: (id) => api.get(`/rutas/${id}`),
    createRoute: (ruta) => api.post('/rutas', ruta),
    updateRoute: (id, ruta) => api.put(`/rutas/${id}`, ruta),
    deleteRoute: (id) => api.delete(`/rutas/${id}`)
  }

  const rutasPublicadasService = {
    getPublishedRoutes: () => api.get('/rutas-publicadas'),
    getHistoricoRoutes: () => api.get('/rutas-publicadas/historico'),
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

  return { authService, rutasService, rutasPublicadasService }
}
