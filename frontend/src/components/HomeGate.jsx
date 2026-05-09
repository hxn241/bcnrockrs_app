import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Raíz `/`: va al dashboard solo si hay sesión; si no, a login (sin montar Dashboard antes).
 */
export default function HomeGate() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen-root" role="status">
        <p>Cargando…</p>
      </div>
    )
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}
