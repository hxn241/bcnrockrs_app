/**
 * URL base del API en el navegador.
 * Si abres el front por IP (p. ej. móvil en http://192.168.1.41:3001), apuntamos
 * al mismo host con el puerto definido en VITE_API_URL (p. ej. 8001), no a localhost.
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  const fallback = 'http://localhost:8000'
  const base = fromEnv || fallback

  if (typeof window === 'undefined') {
    return base
  }

  const { hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return base
  }

  try {
    const parsed = new URL(base)
    return `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}`
  } catch {
    return base
  }
}
