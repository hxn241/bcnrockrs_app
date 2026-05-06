/** Query opcional para listados con filtros por zona (pais=ES, region, ciudad). */
function listadoSalidasConfig(filters) {
  if (!filters || typeof filters !== 'object') return undefined
  const params = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && String(v).trim() !== '') params[k] = String(v).trim()
  }
  return Object.keys(params).length ? { params } : undefined
}

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

    login: (username, password) => api.post('/auth/login', { username, password }),

    getMe: () => api.get('/auth/me'),

    updateMe: (body) => api.patch('/auth/me', body)
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
