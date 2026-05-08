/**
 * URL base del API en el navegador.
 *
 * - Si VITE_API_URL apunta a un dominio externo (producción), se usa tal cual.
 * - Si abres el front por IP (p. ej. móvil en http://192.168.1.41:3001), apuntamos
 *   al mismo host con el puerto definido en VITE_API_URL (p. ej. 8002), no a localhost.
 * - En localhost se usa el valor de VITE_API_URL o el fallback.
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  const fallback = 'http://localhost:8002'
  const base = fromEnv || fallback

  if (typeof window === 'undefined') {
    return base
  }

  const { hostname } = window.location

  // Localhost: usar la URL configurada directamente
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return base
  }

  try {
    const parsed = new URL(base)

    // Si VITE_API_URL apunta a un dominio externo (producción como Render),
    // no reemplazar el hostname: usar la URL completa tal cual.
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return base
    }

    // Desarrollo LAN: mismo host que el navegador, distinto puerto (el del API).
    // Ej: front en http://192.168.1.41:3001 → API en http://192.168.1.41:8002
    const protocol = window.location.protocol || parsed.protocol
    return `${protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}`
  } catch {
    return base
  }
}

/** URL absoluta para ficheros servidos bajo `/uploads` en el API (p. ej. fotos de rutas). */
export function resolveUploadUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBaseUrl().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
