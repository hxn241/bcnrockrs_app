/**
 * Mensaje legible desde respuestas FastAPI (detail string | lista de errores Pydantic)
 * o fallos de red (sin response).
 */
export function formatApiErrorMessage(err, fallback = 'Operación no disponible.') {
  if (!err?.response) {
    const msg = err?.message || ''
    const isNetwork =
      err?.code === 'ERR_NETWORK' ||
      err?.code === 'ECONNABORTED' ||
      /network/i.test(msg) ||
      /failed to fetch/i.test(msg)
    if (isNetwork || !msg) {
      return 'No hay conexión con el servidor. Comprueba VITE_API_URL en Vercel, que el backend en Render esté activo y CORS_ORIGINS en Render (URL exacta del frontend, https).'
    }
    return msg || fallback
  }
  const d = err.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d.length > 0) {
    const parts = d.map((item) => {
      if (typeof item === 'string') return item
      if (item?.msg) {
        const loc = Array.isArray(item.loc) ? item.loc.filter(Boolean).join('.') : ''
        return loc ? `${loc}: ${item.msg}` : item.msg
      }
      return JSON.stringify(item)
    })
    return parts.join(' ')
  }
  if (err.response?.status === 403) return 'No tienes permiso para esta acción.'
  if (err.response?.status === 401) return 'Sesión caducada: vuelve a iniciar sesión.'
  return fallback
}
