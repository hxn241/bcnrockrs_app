import { useState } from 'react'
import { rutasPublicadasService } from '../services/api'
import MapPreview from './MapPreview'
import LocationLink from './LocationLink'
import '../styles/RouteDetailModal.css'

export default function RouteDetailModal({ route, user, onClose, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asistentes, setAsistentes] = useState(route.asistentes)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editDate, setEditDate] = useState(route.dia_ruta)
  const [editTime, setEditTime] = useState(route.hora_ruta)
  const isUserAttending = asistentes.some(a => a.user_id === user?.id)

  const handleAttendance = async () => {
    setLoading(true)
    setError('')
    try {
      if (isUserAttending) {
        await rutasPublicadasService.removeAttendee(route.id)
        setAsistentes(asistentes.filter(a => a.user_id !== user?.id))
      } else {
        await rutasPublicadasService.addAttendee(route.id)
        setAsistentes([...asistentes, { user_id: user?.id, user: { username: user?.username } }])
      }
      onRefresh()
    } catch (err) {
      setError('Error al actualizar participación')
      setAsistentes(route.asistentes)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRoute = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta ruta?')) {
      return
    }

    setLoading(true)
    setError('')
    try {
      await rutasPublicadasService.unpublishRoute(route.id)
      onClose()
      onRefresh()
    } catch (err) {
      setError('Error al eliminar la ruta')
    } finally {
      setLoading(false)
    }
  }

  const handleEditRoute = async () => {
    setLoading(true)
    setError('')
    try {
      await rutasPublicadasService.updateRoute(route.id, {
        dia_ruta: editDate,
        hora_ruta: editTime
      })
      setIsEditMode(false)
      onRefresh()
    } catch (err) {
      setError('Error al actualizar la ruta')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditDate(route.dia_ruta)
    setEditTime(route.hora_ruta)
    setIsEditMode(false)
  }

  const generateRouteDetails = () => {
    const participantsText = asistentes.length > 0
      ? `\nParticipantes:\n${asistentes.map(a => `  • ${a.user?.username || `Usuario ${a.user_id}`}`).join('\n')}`
      : ''

    const meetingLink = route.link_encuentro_personalizado || route.ruta.link_encuentro
    const restaurantLink = route.link_restaurante_personalizado || route.ruta.link_restaurante

    return `🏍️ ${route.ruta.nombre}

📅 Fecha: ${route.dia_ruta}
🕐 Hora de Salida: ${route.hora_ruta}
👤 Organizador: ${route.organizador?.username || 'Desconocido'}

🗺️ Ruta: ${route.ruta.link_ruta}
📍 Encuentro: ${meetingLink}
${restaurantLink ? `🍽️ Restaurante: ${restaurantLink}\n` : ''}

👥 Participantes: ${asistentes.length}${participantsText}`
  }


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="route-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{route.ruta.nombre}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="route-content">
          {isEditMode ? (
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="edit-date">Fecha:</label>
                <input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-time">Hora de Salida:</label>
                <input
                  id="edit-time"
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="button-group">
                <button
                  className="btn btn-primary"
                  onClick={handleEditRoute}
                  disabled={loading}
                >
                  {loading ? '⏳ Guardando...' : '💾 Guardar'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Información básica */}
              <div className="route-info-section">
                <p><strong>📅 Fecha:</strong> {route.dia_ruta}</p>
                <p><strong>🕐 Hora de Salida:</strong> {route.hora_ruta}</p>
                <p><strong>👤 Organizador:</strong> {route.organizador?.username || 'Desconocido'}</p>
                <p><strong>👥 Participantes:</strong> {asistentes.length}</p>
              </div>

          {/* Google Maps - Recorrido */}
          <div className="maps-section">
            <MapPreview
              url={route.ruta.link_ruta}
              title="🗺️ Recorrido"
            />
          </div>

          {/* Punto de Encuentro */}
          <div className="location-section">
            <LocationLink
              url={route.link_encuentro_personalizado || route.ruta.link_encuentro}
              title={route.link_encuentro_personalizado ? '📍 Punto de Encuentro (personalizado)' : '📍 Punto de Encuentro'}
            />
          </div>

          {/* Restaurante (si existe) */}
          {(route.link_restaurante_personalizado || route.ruta.link_restaurante) && (
            <div className="location-section">
              <LocationLink
                url={route.link_restaurante_personalizado || route.ruta.link_restaurante}
                title={route.link_restaurante_personalizado ? '🍽️ Restaurante (personalizado)' : '🍽️ Restaurante'}
              />
            </div>
          )}

          {/* Lista de asistentes */}
          <div className="attendees-section">
            <h3>👥 Participantes ({asistentes.length})</h3>
            {asistentes.length === 0 ? (
              <p className="no-attendees">Sé el primero en apuntarte</p>
            ) : (
              <ul className="attendees-list">
                {asistentes.map((attendee) => (
                  <li key={attendee.id}>
                    👤 {attendee.user?.username || `Usuario ${attendee.user_id}`}
                  </li>
                ))}
              </ul>
            )}
          </div>

              {/* Botones */}
              <div className="button-group">
                <button
                  className={`btn ${isUserAttending ? 'btn-remove' : 'btn-attend'}`}
                  onClick={handleAttendance}
                  disabled={loading}
                >
                  {loading ? '⏳ Cargando...' : (isUserAttending ? '❌ Desapuntarse' : '✅ Apuntarse')}
                </button>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateRouteDetails())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp"
                  title="Compartir en WhatsApp"
                >
                  💬 WhatsApp
                </a>
                {user?.is_admin && (
                  <button
                    className="btn btn-edit"
                    onClick={() => setIsEditMode(true)}
                    disabled={loading}
                    title="Editar fecha y hora"
                  >
                    ✏️ Editar
                  </button>
                )}
                {user?.is_admin && (
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteRoute}
                    disabled={loading}
                    title="Eliminar ruta publicada"
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
