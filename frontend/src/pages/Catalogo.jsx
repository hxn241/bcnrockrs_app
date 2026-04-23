import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasService } from '../services/api'
import Navigation from '../components/Navigation'
import EditRouteModal from '../components/EditRouteModal'
import '../styles/Dashboard.css'
import '../styles/Catalogo.css'

export default function Catalogo() {
  const { user, logout } = useAuth()
  const [rutas, setRutas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { ruta, mode: 'edit'|'duplicate' }
  const navigate = useNavigate()

  useEffect(() => {
    loadRutas()
  }, [])

  const loadRutas = async () => {
    try {
      setLoading(true)
      const response = await rutasService.getAllRoutes()
      setRutas(response.data)
    } catch (err) {
      setError('Error al cargar las rutas')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="dashboard">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="container">
        <h1>🗂️ Catálogo de Rutas</h1>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Cargando rutas...</div>
        ) : rutas.length === 0 ? (
          <div className="no-routes">No hay rutas en el catálogo.</div>
        ) : (
          <div className="catalogo-grid">
            {rutas.map(ruta => (
              <div key={ruta.id} className="catalogo-card">
                <div className="catalogo-info">
                  <h3>{ruta.nombre}</h3>
                  <div className="catalogo-links">
                    <a href={ruta.link_ruta} target="_blank" rel="noopener noreferrer">🗺️ Ver ruta</a>
                    <a href={ruta.link_encuentro} target="_blank" rel="noopener noreferrer">📍 Encuentro</a>
                    {ruta.link_restaurante && (
                      <a href={ruta.link_restaurante} target="_blank" rel="noopener noreferrer">🍽️ Restaurante</a>
                    )}
                  </div>
                </div>
                <div className="catalogo-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setModal({ ruta, mode: 'edit' })}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => setModal({ ruta, mode: 'duplicate' })}
                  >
                    📋 Duplicar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <EditRouteModal
          ruta={modal.ruta}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={loadRutas}
        />
      )}
    </div>
  )
}
