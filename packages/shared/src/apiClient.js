import axios from 'axios'

/**
 * Cliente HTTP compartido entre web (Vite) y móvil (React Native).
 * En RN: getToken suele leer AsyncStorage; en web, localStorage.
 */
export function createApiClient({ baseURL, getToken }) {
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
