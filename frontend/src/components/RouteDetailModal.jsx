import { useState, useEffect, useMemo } from 'react'
import { rutasPublicadasService } from '../services/api'
import MapPreview from './MapPreview'
import LocationLink from './LocationLink'
import GoogleMapsLinkInfo from './GoogleMapsLinkInfo'
import RoutePhotosGallery from './RoutePhotosGallery'
import { formatUbicacionSalida } from '../constants/paisesSalida'
import {
  COMUNIDADES_AUTONOMAS,
  provinciasPorComunidad,
  normalizarCodigoProvincia,
  inferirCcaaDesdeProvincia,
  tieneZonaSalida
} from '../constants/espanaUbicacion'
import '../styles/RouteDetailModal.css'

function ccaaDesdeRuta(route) {
  const raw = (route?.ubicacion_region || '').trim().toUpperCase()
  if (raw && COMUNIDADES_AUTONOMAS.some((c) => c.code === raw)) return raw
  return inferirCcaaDesdeProvincia(route?.ubicacion_ciudad) || ''
}

function provinciaDesdeRuta(route) {
  return normalizarCodigoProvincia(route?.ubicacion_ciudad)
}

function isSalidaPasada(diaRuta) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${diaRuta}T12:00:00`)
  return d < today
}

function usuarioEsAdminApp(user) {
  return user?.is_admin === true || user?.is_admin === 1
}

function mismoOrganizadorSalida(user, route) {
  const uid = user?.id
  const oid = route?.organizador_id ?? route?.organizador?.id
  if (uid == null || oid == null) return false
  return Number(uid) === Number(oid)
}

export default function RouteDetailModal({
  route,
  user,
  onClose,
  onRefresh,
  historico = false
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asistentes, setAsistentes] = useState(route.asistentes)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editDate, setEditDate] = useState(route.dia_ruta)
  const [editTime, setEditTime] = useState(route.hora_ruta)
  const [editEncuentro, setEditEncuentro] = useState(
    () => route.link_encuentro_personalizado || route.ruta?.link_encuentro || ''
  )
  const [editCcaa, setEditCcaa] = useState(() => ccaaDesdeRuta(route))
  const [editProvincia, setEditProvincia] = useState(() => provinciaDesdeRuta(route))
  const isUserAttending = asistentes.some(
    (a) => user?.id != null && Number(a.user_id) === Number(user.id)
  )

  const provinciasEdicion = useMemo(() => provinciasPorComunidad(editCcaa), [editCcaa])

  const esCreadorGrupoSalida =
    route.visibilidad === 'grupo' &&
    route.grupo != null &&
    Number(user?.id) === Number(route.grupo.creador_id)

  const salidaPasada = historico === true || isSalidaPasada(route.dia_ruta)

  const canManageRoute =
    Boolean(user) &&
    (usuarioEsAdminApp(user) ||
      mismoOrganizadorSalida(user, route) ||
      esCreadorGrupoSalida)

  /** Organizador, líder de grupo (salida de grupo) o admin: pueden despublicar siempre que el backend lo permita (sin depender del reloj local vs servidor). */
  const showDeleteButton = canManageRoute

  const meetingUrl = route.link_encuentro_personalizado || route.ruta?.link_encuentro
  const meetLabel = route.link_encuentro_personalizado
    ? 'Punto de encuentro (personalizado)'
    : 'Punto de encuentro'
  const restaurantUrl = route.link_restaurante_personalizado || route.ruta?.link_restaurante
  const rutaGmapsUrl = route.ruta?.link_ruta
  const catalogoEncuentro = route.ruta?.link_encuentro || ''

  useEffect(() => {
    setAsistentes(route.asistentes || [])
  }, [route.id, route.asistentes])

  useEffect(() => {
    if (isEditMode) return
    setEditDate(route.dia_ruta)
    setEditTime(route.hora_ruta)
    setEditEncuentro(route.link_encuentro_personalizado || route.ruta?.link_encuentro || '')
    setEditCcaa(ccaaDesdeRuta(route))
    setEditProvincia(provinciaDesdeRuta(route))
  }, [route, isEditMode])

  const handleAttendance = async () => {
    setLoading(true)
    setError('')
    try {
      if (isUserAttending) {
        await rutasPublicadasService.removeAttendee(route.id)
        setAsistentes(
          asistentes.filter((a) => Number(a.user_id) !== Number(user?.id))
        )
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
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Error al eliminar la ruta')
    } finally {
      setLoading(false)
    }
  }

  const handleEditRoute = async () => {
    setLoading(true)
    setError('')
    try {
      const trimmed = editEncuentro.trim()
      if (!trimmed) {
        setError('Indica un enlace de punto de encuentro o pega el del catálogo.')
        setLoading(false)
        return
      }
      const ccaa = editCcaa.trim().toUpperCase()
      const prov = normalizarCodigoProvincia(editProvincia)
      const sameAsCatalogo = trimmed === (catalogoEncuentro || '').trim()
      const payload = {
        dia_ruta: editDate,
        hora_ruta: editTime,
        link_encuentro_personalizado: sameAsCatalogo ? null : trimmed,
        ubicacion_pais: 'ES',
        ubicacion_region: ccaa || null,
        ubicacion_ciudad: prov || null
      }
      await rutasPublicadasService.updateRoute(route.id, payload)
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
    setEditEncuentro(route.link_encuentro_personalizado || route.ruta?.link_encuentro || '')
    setEditCcaa(ccaaDesdeRuta(route))
    setEditProvincia(provinciaDesdeRuta(route))
    setIsEditMode(false)
  }

  const startEdit = () => {
    setEditDate(route.dia_ruta)
    setEditTime(route.hora_ruta)
    setEditEncuentro(route.link_encuentro_personalizado || route.ruta?.link_encuentro || '')
    setEditCcaa(ccaaDesdeRuta(route))
    setEditProvincia(provinciaDesdeRuta(route))
    setIsEditMode(true)
  }

  const generateRouteDetails = () => {
    const participantsText = asistentes.length > 0
      ? `\nParticipantes:\n${asistentes.map(a => `  • ${a.user?.username || `Usuario ${a.user_id}`}`).join('\n')}`
      : ''

    const meetingLink = route.link_encuentro_personalizado || route.ruta.link_encuentro
    const restaurantLink = route.link_restaurante_personalizado || route.ruta.link_restaurante

    const zonaTxt = tieneZonaSalida(route) ? `\n🌍 Zona: ${formatUbicacionSalida(route)}\n` : '\n'

    return `🏍️ ${route.ruta.nombre}

📅 Fecha: ${route.dia_ruta}
🕐 Hora de Salida: ${route.hora_ruta}
👤 Organizador: ${route.organizador?.username || 'Desconocido'}${zonaTxt}
🗺️ Ruta: ${route.ruta.link_ruta}
📍 Encuentro: ${meetingLink}
${restaurantLink ? `🍽️ Restaurante: ${restaurantLink}\n` : ''}

👥 Participantes: ${asistentes.length}${participantsText}`
  }


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="route-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{route.ruta.nombre}</h2>
            <div
              className={`route-salida-visibilidad ${route.visibilidad === 'grupo' ? 'grupo' : 'abierta'}`}
              style={{ marginTop: 8 }}
            >
              {route.visibilidad === 'grupo'
                ? `Solo grupo: ${route.grupo?.nombre || '…'}`
                : 'Salida abierta'}
            </div>
          </div>
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
              <div className="form-group">
                <div className="form-label-with-gmaps-info">
                  <label htmlFor="edit-encuentro">Punto de encuentro (enlace Google Maps):</label>
                  <GoogleMapsLinkInfo />
                </div>
                <input
                  id="edit-encuentro"
                  type="url"
                  value={editEncuentro}
                  onChange={(e) => setEditEncuentro(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  disabled={loading}
                />
                <p className="edit-hint-encuentro">
                  Si coincide con el enlace del catálogo, se guarda el predeterminado. Déjalo distinto para un punto de encuentro solo para este día.
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="edit-ccaa">Comunidad autónoma</label>
                <select
                  id="edit-ccaa"
                  className="publish-modal-control"
                  value={editCcaa}
                  onChange={(e) => {
                    setEditCcaa(e.target.value)
                    setEditProvincia('')
                  }}
                  disabled={loading}
                >
                  <option value="">— Sin especificar —</option>
                  {COMUNIDADES_AUTONOMAS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-provincia">Provincia</label>
                <select
                  id="edit-provincia"
                  className="publish-modal-control"
                  value={editProvincia}
                  onChange={(e) => setEditProvincia(e.target.value)}
                  disabled={loading || !editCcaa}
                >
                  <option value="">— Sin especificar —</option>
                  {provinciasEdicion.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
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
              {/* Fecha, hora, punto de encuentro, organizador y nº participantes */}
              <div className="route-info-section">
                {salidaPasada && !historico && (
                  <p className="route-historico-badge">
                    Esta salida ya pasó; también está en <strong>Histórico</strong>. Aquí puedes ver fotos y participantes.
                  </p>
                )}
                <p><strong>📅 Fecha:</strong> {route.dia_ruta}</p>
                <p><strong>🕐 Hora de Salida:</strong> {route.hora_ruta}</p>
                {tieneZonaSalida(route) && (
                  <p>
                    <strong>🌍 Zona:</strong> {formatUbicacionSalida(route)}
                  </p>
                )}
                <LocationLink
                  url={meetingUrl}
                  layout="inline"
                  label={meetLabel}
                />
                <p><strong>👤 Organizador:</strong> {route.organizador?.username || 'Desconocido'}</p>
                <p><strong>👥 Participantes:</strong> {asistentes.length}</p>
              </div>

          <div className="maps-section">
            <MapPreview
              url={rutaGmapsUrl}
              embedUrl={route.ruta?.embed_recorrido_url}
              title="🗺️ Recorrido"
            />
            {rutaGmapsUrl && (
              <div className="maps-gmaps-actions">
                <a
                  href={rutaGmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-maps-gmaps"
                >
                  Abrir en GMaps
                </a>
              </div>
            )}
          </div>

          {restaurantUrl && (
            <div className="location-section">
              <LocationLink
                url={restaurantUrl}
                title={route.link_restaurante_personalizado ? '🍽️ Restaurante (personalizado)' : '🍽️ Restaurante'}
              />
            </div>
          )}

          {/* Lista de asistentes */}
          <div className="attendees-section">
            <h3>👥 Participantes ({asistentes.length})</h3>
            {asistentes.length === 0 ? (
              <p className="no-attendees">
                {salidaPasada ? 'No constaban participantes apuntados.' : 'Sé el primero en apuntarte'}
              </p>
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

          {salidaPasada && (
            <RoutePhotosGallery rutaPublicadaId={route.id} user={user} />
          )}

              {/* Botones */}
              <div className="button-group">
                {!salidaPasada && (
                  <button
                    className={`btn ${isUserAttending ? 'btn-remove' : 'btn-attend'}`}
                    onClick={handleAttendance}
                    disabled={loading || !user}
                    title={!user ? 'Inicia sesión para apuntarte' : undefined}
                  >
                    {loading ? '⏳ Cargando...' : (isUserAttending ? '❌ Desapuntarse' : '✅ Apuntarse')}
                  </button>
                )}
                {!historico && (
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateRouteDetails())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-whatsapp"
                    title="Compartir en WhatsApp"
                  >
                    💬 WhatsApp
                  </a>
                )}
                {canManageRoute && !salidaPasada && (
                  <button
                    className="btn btn-edit"
                    onClick={startEdit}
                    disabled={loading}
                    title="Editar ruta (fecha, hora, punto de encuentro)"
                  >
                    ✏️ Editar
                  </button>
                )}
                {showDeleteButton && (
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteRoute}
                    disabled={loading}
                    title={
                      historico
                        ? 'Quitar esta salida del histórico (despublicar)'
                        : 'Eliminar ruta publicada'
                    }
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
