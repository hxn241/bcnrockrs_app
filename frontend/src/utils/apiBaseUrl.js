/**
 * URL base del API en el navegador.
 * Si abres el front por IP (p. ej. móvil en http://192.168.1.41:3001), apuntamos
 * al mismo host con el puerto definido en VITE_API_URL (p. ej. 8002), no a localhost.
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  const fallback = 'http://localhost:8002'
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
    // Misma capa que la página (http/https). Si el front es https://dominio:3000 y el API
    // se arma con protocolo de localhost (http), el navegador bloquea por mixed content.
    const protocol = window.location.protocol || parsed.protocol
    return `${protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}`
  } catch {
    return base
  }
}
