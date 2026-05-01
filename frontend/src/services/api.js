import { createApiClient, createServices } from '@bcnrockrs/shared'
import { getApiBaseUrl } from '../utils/apiBaseUrl'

const api = createApiClient({
  baseURL: getApiBaseUrl(),
  getToken: () => localStorage.getItem('token')
})

const { authService, rutasService, rutasPublicadasService } = createServices(api)

export { authService, rutasService, rutasPublicadasService }
export default api
