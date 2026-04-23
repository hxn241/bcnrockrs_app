import LocationLink from './LocationLink'
import MapPreview from './MapPreview'
import '../styles/RouteCard.css'

export default function RouteCard({ route, user, onAttend, onRemove }) {
  const isUserAttending = route.asistentes.some(a => a.user_id === user?.id)

  return (
    <div className="route-card">
      <div className="route-header">
        <h3>{route.ruta.nombre}</h3>
        <span className="route-date">
          📅 {route.dia_ruta} - {route.hora_ruta}
        </span>
      </div>

      <div className="route-organizer">
        <p>👤 <strong>Organizador:</strong> {route.organizador?.username || 'Desconocido'}</p>
      </div>

      <div className="route-details">
        {route.ruta.link_ruta && (
          <div style={{ marginTop: '10px', marginBottom: '10px' }}>
            <MapPreview
              url={route.ruta.link_ruta}
              title="🗺️ Recorrido"
            />
          </div>
        )}

        {(route.link_encuentro_personalizado || route.ruta.link_encuentro) && (
          <div style={{ marginTop: '10px' }}>
            <LocationLink
              url={route.link_encuentro_personalizado || route.ruta.link_encuentro}
              title={route.link_encuentro_personalizado ? '📍 Punto de Encuentro (personalizado)' : '📍 Punto de Encuentro'}
            />
          </div>
        )}

        {(route.link_restaurante_personalizado || route.ruta.link_restaurante) && (
          <div style={{ marginTop: '10px' }}>
            <LocationLink
              url={route.link_restaurante_personalizado || route.ruta.link_restaurante}
              title={route.link_restaurante_personalizado ? '🍽️ Restaurante (personalizado)' : '🍽️ Restaurante'}
            />
          </div>
        )}
      </div>

      <div className="attendees">
        <span>👥 {route.asistentes.length} participante{route.asistentes.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="route-actions">
        {isUserAttending ? (
          <button 
            className="btn btn-remove"
            onClick={() => onRemove(route.id)}
          >
            Desapuntarse
          </button>
        ) : (
          <button 
            className="btn btn-attend"
            onClick={() => onAttend(route.id)}
          >
            Apuntarse
          </button>
        )}
      </div>
    </div>
  )
}
