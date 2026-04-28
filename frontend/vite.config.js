import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Escucha en 0.0.0.0 para acceder por IP local, túnel o hexen88.dynv6.net
    host: true,
    port: 3000,
    allowedHosts: ['hexen88.dynv6.net', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
