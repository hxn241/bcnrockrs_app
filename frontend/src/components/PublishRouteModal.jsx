import { useState, useEffect } from 'react'
import { rutasService, rutasPublicadasService } from '../services/api'
import GoogleMapEmbed from './GoogleMapEmbed'
import GoogleMapsLinkInfo from './GoogleMapsLinkInfo'
import '../styles/PublishRouteModal.css'

export default function PublishRouteModal({ date, onClose, onPublish }) {
  const [mode, setMode] = useState('select')
  const [rutas, setRutas] = useState([])
  const [selectedRutaId, setSelectedRutaId] = useState('')
  const [hora, setHora] = useState('10:00')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newRuta, setNewRuta] = useState({
    nombre: '',
    link_ruta: '',
    link_encuentro: '',
    link_restaurante: ''
  })

  const [selectedEncuentro, setSelectedEncuentro] = useState('')
  const [selectedRestaurante, setSelectedRestaurante] = useState('')

  const selectedRuta = rutas.find(r => r.id === parseInt(selectedRutaId))

  // Validar si es hoy
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selectedDate = new Date(date + 'T00:00:00')
  const isToday = selectedDate.getTime() === today.getTime()

  // Obtener hora actual en formato HH:MM si es hoy
  const getCurrentTimeString = () => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  const minTime = isToday ? getCurrentTimeString() : '00:00'

  useEffect(() => {
    loadRutas()
  }, [])

  const loadRutas = async () => {
    try {
      setLoading(true)
      const response = await rutasService.getRoutesForPublish()
      setRutas(response.data)
      if (response.data.length > 0) {
        const firstId = String(response.data[0].id)
        setSelectedRutaId(firstId)
        setSelectedEncuentro(response.data[0].link_encuentro)
      }
    } catch (err) {
      setError('Error al cargar rutas')
    } finally {
      setLoading(false)
    }
  }

  const handlePublishSelected = async () => {
    if (!selectedRutaId || !hora) {
      setError('Selecciona una ruta y hora')
      return
    }

    // Validar hora si es hoy
    if (isToday) {
      const currentTime = getCurrentTimeString()
      if (hora < currentTime) {
        setError(`❌ No puedes publicar rutas a una hora pasada. Hora actual: ${currentTime}`)
        return
      }
    }

    try {
      const payload = {
        ruta_id: parseInt(selectedRutaId),
        dia_ruta: date,
        hora_ruta: hora
      }

      if (selectedEncuentro && selectedEncuentro !== selectedRuta.link_encuentro) {
        payload.link_encuentro_personalizado = selectedEncuentro
      }

      if (selectedRestaurante) {
        payload.link_restaurante_personalizado = selectedRestaurante
      }

      await rutasPublicadasService.publishRoute(payload)
      onPublish()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al publicar')
    }
  }

  const handleCreateAndPublish = async () => {
    if (!newRuta.nombre || !newRuta.link_ruta || !newRuta.link_encuentro || !hora) {
      setError('Completa todos los campos requeridos')
      return
    }

    // Validar hora si es hoy
    if (isToday) {
      const currentTime = getCurrentTimeString()
      if (hora < currentTime) {
        setError(`❌ No puedes publicar rutas a una hora pasada. Hora actual: ${currentTime}`)
        return
      }
    }

    try {
      const rutaResponse = await rutasService.createRoute(newRuta)
      await rutasPublicadasService.publishRoute({
        ruta_id: rutaResponse.data.id,
        dia_ruta: date,
        hora_ruta: hora
      })
      onPublish()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear ruta')
    }
  }

  const getLocationName = (url) => {
    if (!url) return 'Ubicación'
    try {
      // Patrón 1: /place/NombreDeLugar/...
      if (url.includes('/place/')) {
        const placeName = url.split('/place/')[1]?.split('/')[0]?.split('@')[0]
        if (placeName) {
          return decodeURIComponent(placeName).replace(/\+/g, ' ')
        }
      }
      // Patrón 2: /search/NombreDeLugar/...
      if (url.includes('/search/')) {
        const searchName = url.split('/search/')[1]?.split('/')[0]?.split('@')[0]
        if (searchName) {
          return decodeURIComponent(searchName).replace(/\+/g, ' ')
        }
      }
      // Patrón 3: parámetro q=
      if (url.includes('?q=') || url.includes('&q=')) {
        const q = new URL(url).searchParams.get('q')
        if (q) return decodeURIComponent(q).replace(/\+/g, ' ')
      }
      return 'Ubicación'
    } catch {
      return 'Ubicación'
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Crear ruta para {date}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="mode-buttons">
          <button
            className={`mode-btn ${mode === 'select' ? 'active' : ''}`}
            onClick={() => setMode('select')}
          >
            Seleccionar Ruta
          </button>
          <button
            className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >
            Crear Nueva
          </button>
        </div>

        <div className="mode-content">
          {mode === 'select' ? (
            <>
              {loading ? (
                <p className="loading-text">Cargando rutas...</p>
              ) : rutas.length === 0 ? (
                <p className="no-routes">No hay rutas disponibles. Crea una nueva.</p>
              ) : (
                <div className="route-preview">
                  <div className="form-group">
                    <label htmlFor="publish-ruta-select">Selecciona una Ruta *</label>
                    <select
                      id="publish-ruta-select"
                      className="publish-modal-control"
                      value={selectedRutaId}
                      onChange={(e) => {
                        setSelectedRutaId(e.target.value)
                        const ruta = rutas.find(r => r.id === parseInt(e.target.value))
                        setSelectedEncuentro(ruta?.link_encuentro || '')
                        setSelectedRestaurante('')
                      }}
                    >
                      {rutas.map(ruta => (
                        <option key={ruta.id} value={ruta.id}>
                          {ruta.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedRuta && (
                    <>
                      <div className="map-section">
                        <GoogleMapEmbed
                          url={selectedRuta.link_ruta}
                          embedUrl={selectedRuta.embed_recorrido_url}
                          title="Recorrido"
                        />
                      </div>

                      <div className="form-group">
                        <div className="form-label-with-gmaps-info">
                          <label htmlFor="publish-encuentro">Punto de Encuentro</label>
                          <GoogleMapsLinkInfo />
                        </div>
                        <input
                          id="publish-encuentro"
                          className="publish-modal-control"
                          type="url"
                          value={selectedEncuentro}
                          onChange={(e) => setSelectedEncuentro(e.target.value)}
                          placeholder="https://maps.app.goo.gl/..."
                        />
                      </div>

                      <div className="form-group">
                        <div className="form-label-with-gmaps-info">
                          <label htmlFor="publish-restaurante">Restaurante (Opcional)</label>
                          <GoogleMapsLinkInfo />
                        </div>
                        <input
                          id="publish-restaurante"
                          className="publish-modal-control"
                          type="url"
                          value={selectedRestaurante}
                          onChange={(e) => setSelectedRestaurante(e.target.value)}
                          placeholder="https://maps.app.goo.gl/..."
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="publish-hora-salida">Hora de Salida *</label>
                        <input
                          id="publish-hora-salida"
                          className="publish-modal-control"
                          type="time"
                          value={hora}
                          onChange={(e) => setHora(e.target.value)}
                          min={minTime}
                        />
                        {isToday && <p className="form-hint-time">⏰ Solo horas a partir de ahora ({minTime})</p>}
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={handlePublishSelected}
                      >
                        Publicar Ruta
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="route-preview">
              <div className="form-group">
                <label htmlFor="create-ruta-nombre">Nombre de la Ruta *</label>
                <input
                  id="create-ruta-nombre"
                  className="publish-modal-control"
                  type="text"
                  value={newRuta.nombre}
                  onChange={(e) => setNewRuta({...newRuta, nombre: e.target.value})}
                  placeholder="Ej: Ruta de Barcelona"
                />
              </div>

              <div className="form-group">
                <div className="form-label-with-gmaps-info">
                  <label htmlFor="create-ruta-link">Link de la Ruta (Google Maps) *</label>
                  <GoogleMapsLinkInfo />
                </div>
                <input
                  id="create-ruta-link"
                  className="publish-modal-control"
                  type="url"
                  value={newRuta.link_ruta}
                  onChange={(e) => setNewRuta({...newRuta, link_ruta: e.target.value})}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>

              <div className="form-group">
                <div className="form-label-with-gmaps-info">
                  <label htmlFor="create-ruta-encuentro">Punto de Encuentro (Link) *</label>
                  <GoogleMapsLinkInfo />
                </div>
                <input
                  id="create-ruta-encuentro"
                  className="publish-modal-control"
                  type="url"
                  value={newRuta.link_encuentro}
                  onChange={(e) => setNewRuta({...newRuta, link_encuentro: e.target.value})}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>

              <div className="form-group">
                <div className="form-label-with-gmaps-info">
                  <label htmlFor="create-ruta-restaurante">Restaurante (Link Opcional)</label>
                  <GoogleMapsLinkInfo />
                </div>
                <input
                  id="create-ruta-restaurante"
                  className="publish-modal-control"
                  type="url"
                  value={newRuta.link_restaurante}
                  onChange={(e) => setNewRuta({...newRuta, link_restaurante: e.target.value})}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-ruta-hora">Hora de Salida *</label>
                <input
                  id="create-ruta-hora"
                  className="publish-modal-control"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  min={minTime}
                />
                {isToday && <p className="form-hint-time">⏰ Solo horas a partir de ahora ({minTime})</p>}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleCreateAndPublish}
              >
                Crear y Publicar Ruta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
