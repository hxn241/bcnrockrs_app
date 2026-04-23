import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasService, rutasPublicadasService } from '../services/api'
import Navigation from '../components/Navigation'
import '../styles/AdminPanel.css'

export default function AdminPanel() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [rutas, setRutas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form states
  const [showNewRutaForm, setShowNewRutaForm] = useState(false)
  const [showPublishForm, setShowPublishForm] = useState(false)
  const [selectedRutaId, setSelectedRutaId] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [publishTime, setPublishTime] = useState('')

  const [newRuta, setNewRuta] = useState({
    nombre: '',
    link_ruta: '',
    link_encuentro: '',
    link_restaurante: '',
    fecha: '',
    hora: ''
  })

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    loadRutas()
  }, [user, navigate])

  const loadRutas = async () => {
    try {
      setLoading(true)
      const response = await rutasService.getAllRoutes()
      setRutas(response.data)
    } catch (err) {
      setError('Error al cargar las rutas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRuta = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      await rutasService.createRoute(newRuta)
      setSuccess('✅ Ruta creada exitosamente')
      setNewRuta({
        nombre: '',
        link_ruta: '',
        link_encuentro: '',
        link_restaurante: '',
        fecha: '',
        hora: ''
      })
      setShowNewRutaForm(false)
      loadRutas()
    } catch (err) {
      setError('Error al crear la ruta: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handlePublishRuta = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedRutaId || !publishDate || !publishTime) {
      setError('Completa todos los campos')
      return
    }

    try {
      await rutasPublicadasService.publishRoute({
        ruta_id: parseInt(selectedRutaId),
        dia_ruta: publishDate,
        hora_ruta: publishTime
      })
      setSuccess('✅ Ruta publicada exitosamente')
      setSelectedRutaId('')
      setPublishDate('')
      setPublishTime('')
      setShowPublishForm(false)
    } catch (err) {
      setError('Error al publicar: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user?.is_admin) {
    return <div>Acceso denegado. Solo administradores pueden acceder.</div>
  }

  return (
    <div className="admin-panel">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="admin-container">
        <h1>⚙️ Panel de Administración</h1>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="admin-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowNewRutaForm(!showNewRutaForm)}
          >
            {showNewRutaForm ? '✕ Cancelar' : '➕ Crear Nueva Ruta'}
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowPublishForm(!showPublishForm)}
          >
            {showPublishForm ? '✕ Cancelar' : '📅 Publicar Ruta'}
          </button>
        </div>

        {/* Formulario crear ruta */}
        {showNewRutaForm && (
          <div className="form-section">
            <h2>Crear Nueva Ruta</h2>
            <form onSubmit={handleCreateRuta}>
              <div className="form-group">
                <label>Nombre de la Ruta *</label>
                <input
                  type="text"
                  value={newRuta.nombre}
                  onChange={(e) => setNewRuta({...newRuta, nombre: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Link de la Ruta (Google Maps, etc) *</label>
                <input
                  type="url"
                  value={newRuta.link_ruta}
                  onChange={(e) => setNewRuta({...newRuta, link_ruta: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Punto de Encuentro (Link) *</label>
                <input
                  type="url"
                  value={newRuta.link_encuentro}
                  onChange={(e) => setNewRuta({...newRuta, link_encuentro: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Restaurante (Link)</label>
                <input
                  type="url"
                  value={newRuta.link_restaurante}
                  onChange={(e) => setNewRuta({...newRuta, link_restaurante: e.target.value})}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha (opcional)</label>
                  <input
                    type="date"
                    value={newRuta.fecha}
                    onChange={(e) => setNewRuta({...newRuta, fecha: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Hora (opcional)</label>
                  <input
                    type="time"
                    value={newRuta.hora}
                    onChange={(e) => setNewRuta({...newRuta, hora: e.target.value})}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-success">Crear Ruta</button>
            </form>
          </div>
        )}

        {/* Formulario publicar ruta */}
        {showPublishForm && (
          <div className="form-section">
            <h2>Publicar Ruta en una Fecha</h2>
            <form onSubmit={handlePublishRuta}>
              <div className="form-group">
                <label>Selecciona una Ruta *</label>
                <select
                  value={selectedRutaId}
                  onChange={(e) => setSelectedRutaId(e.target.value)}
                  required
                >
                  <option value="">-- Selecciona una ruta --</option>
                  {rutas.map(ruta => (
                    <option key={ruta.id} value={ruta.id}>
                      {ruta.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Fecha de Publicación *</label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Hora de Salida *</label>
                <input
                  type="time"
                  value={publishTime}
                  onChange={(e) => setPublishTime(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-success">Publicar Ruta</button>
            </form>
          </div>
        )}

        {/* Lista de rutas */}
        <div className="rutas-list">
          <h2>Rutas Disponibles ({rutas.length})</h2>
          
          {loading ? (
            <div className="loading">Cargando rutas...</div>
          ) : rutas.length === 0 ? (
            <p className="no-rutas">No hay rutas creadas. ¡Crea una nueva!</p>
          ) : (
            <div className="rutas-table">
              {rutas.map(ruta => (
                <div key={ruta.id} className="ruta-item">
                  <div className="ruta-info">
                    <h3>{ruta.nombre}</h3>
                    <p><strong>ID:</strong> {ruta.id}</p>
                    {ruta.fecha !== 'Por definir' && <p><strong>Fecha:</strong> {ruta.fecha}</p>}
                    {ruta.hora !== 'Por confirmar' && <p><strong>Hora:</strong> {ruta.hora}</p>}
                  </div>
                  <div className="ruta-links">
                    {ruta.link_ruta && (
                      <a href={ruta.link_ruta} target="_blank" rel="noopener noreferrer">
                        🗺️ Ruta
                      </a>
                    )}
                    {ruta.link_encuentro && (
                      <a href={ruta.link_encuentro} target="_blank" rel="noopener noreferrer">
                        📍 Encuentro
                      </a>
                    )}
                    {ruta.link_restaurante && (
                      <a href={ruta.link_restaurante} target="_blank" rel="noopener noreferrer">
                        🍽️ Restaurante
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
