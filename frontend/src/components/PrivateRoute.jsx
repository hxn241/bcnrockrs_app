import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
