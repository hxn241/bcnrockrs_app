import { useState, useEffect, useMemo, useCallback } from 'react'
import { rutasService, rutasPublicadasService, gruposService } from '../services/api'
import GoogleMapEmbed from './GoogleMapEmbed'
import GoogleMapsLinkInfo from './GoogleMapsLinkInfo'
import {
  COMUNIDADES_AUTONOMAS,
  provinciasPorComunidad,
  normalizarCodigoProvincia,
  nombreComunidad,
  nombreProvincia
} from '../constants/espanaUbicacion'
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

  const [tipoSalida, setTipoSalida] = useState('abierta')
  const [grupoPublicacionId, setGrupoPublicacionId] = useState('')
  const [misGrupos, setMisGrupos] = useState([])

  const [filtListaCcaa, setFiltListaCcaa] = useState('')
  const [filtListaProvincia, setFiltListaProvincia] = useState('')
  const [catalogoCcaa, setCatalogoCcaa] = useState('')
  const [catalogoProvincia, setCatalogoProvincia] = useState('')

  const selectedRuta = rutas.find(r => r.id === parseInt(selectedRutaId))

  const provinciasFiltroLista = useMemo(
    () => provinciasPorComunidad(filtListaCcaa),
    [filtListaCcaa]
  )

  const provinciasCatalogoNueva = useMemo(
    () => provinciasPorComunidad(catalogoCcaa),
    [catalogoCcaa]
  )

  const buildVisibilidadPayload = () => {
    if (tipoSalida === 'grupo') {
      const id = parseInt(grupoPublicacionId, 10)
      if (!grupoPublicacionId || Number.isNaN(id)) return null
      return { visibilidad: 'grupo', grupo_id: id }
    }
    return { visibilidad: 'abierta' }
  }

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
    gruposService
      .misGrupos()
      .then((res) => setMisGrupos(res.data || []))
      .catch(() => setMisGrupos([]))
  }, [])

  const loadRutas = useCallback(async () => {
    try {
      setError('')
      setLoading(true)
      const filters = {}
      if (filtListaCcaa.trim()) filters.ccaa = filtListaCcaa.trim().toUpperCase()
      const fp = normalizarCodigoProvincia(filtListaProvincia)
      if (fp) filters.provincia = fp
      const response = await rutasService.getRoutesForPublish(filters)
      const list = response.data || []
      setRutas(list)
      if (list.length > 0) {
        const firstId = String(list[0].id)
        setSelectedRutaId(firstId)
        setSelectedEncuentro(list[0].link_encuentro)
      } else {
        setSelectedRutaId('')
        setSelectedEncuentro('')
      }
    } catch (err) {
      setError('Error al cargar rutas')
    } finally {
      setLoading(false)
    }
  }, [filtListaCcaa, filtListaProvincia])

  useEffect(() => {
    loadRutas()
  }, [loadRutas])

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

    const vis = buildVisibilidadPayload()
    if (!vis) {
      setError('Para salida de grupo elige un grupo (o crea uno en «Grupos»).')
      return
    }

    const provPlantilla = normalizarCodigoProvincia(selectedRuta?.ubicacion_ciudad)
    if (!selectedRuta?.ubicacion_region?.trim() || !provPlantilla) {
      setError(
        'Esta plantilla no tiene comunidad y provincia en el catálogo. Complétalas en «Catálogo de rutas» (admin) o crea una plantilla nueva con zona.'
      )
      return
    }

    try {
      const payload = {
        ruta_id: parseInt(selectedRutaId),
        dia_ruta: date,
        hora_ruta: hora,
        ubicacion_pais: 'ES',
        ubicacion_region: selectedRuta.ubicacion_region.trim().toUpperCase(),
        ubicacion_ciudad: provPlantilla,
        ...vis
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

    const vis = buildVisibilidadPayload()
    if (!vis) {
      setError('Para salida de grupo elige un grupo (o crea uno en «Grupos»).')
      return
    }

    const catProv = normalizarCodigoProvincia(catalogoProvincia)
    if (!catalogoCcaa.trim() || !catProv) {
      setError('Indica comunidad autónoma y provincia de la plantilla (donde encaja la ruta en el mapa).')
      return
    }

    try {
      const rutaResponse = await rutasService.createRoute({
        ...newRuta,
        ubicacion_region: catalogoCcaa.trim().toUpperCase(),
        ubicacion_ciudad: catProv
      })
      const created = rutaResponse.data
      const provCreated = normalizarCodigoProvincia(created.ubicacion_ciudad)
      await rutasPublicadasService.publishRoute({
        ruta_id: created.id,
        dia_ruta: date,
        hora_ruta: hora,
        ubicacion_pais: 'ES',
        ubicacion_region: created.ubicacion_region.trim().toUpperCase(),
        ubicacion_ciudad: provCreated,
        ...vis
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

        <div className="publish-tipo-salida-block">
          <p className="publish-ubicacion-title">¿Quién puede ver esta salida?</p>
          <p className="publish-ubicacion-hint">
            <strong>Abierta:</strong> aparece para todos en calendario y filtros.
            <strong> Grupo:</strong> solo miembros del grupo (únete en «Grupos»). La zona (CCAA/provincia) de la salida es la de la plantilla del catálogo, no se indica aquí.
          </p>
          <div className="publish-tipo-salida-options">
            <label className="publish-tipo-salida-label">
              <input
                type="radio"
                name="tipo-salida"
                checked={tipoSalida === 'abierta'}
                onChange={() => setTipoSalida('abierta')}
              />
              Salida abierta
            </label>
            <label className="publish-tipo-salida-label">
              <input
                type="radio"
                name="tipo-salida"
                checked={tipoSalida === 'grupo'}
                onChange={() => setTipoSalida('grupo')}
              />
              Solo mi grupo
            </label>
          </div>
          {tipoSalida === 'grupo' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label htmlFor="publish-grupo">Grupo *</label>
              <select
                id="publish-grupo"
                className="publish-modal-control"
                value={grupoPublicacionId}
                onChange={(e) => setGrupoPublicacionId(e.target.value)}
              >
                <option value="">— Elige grupo —</option>
                {misGrupos.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              {misGrupos.length === 0 && (
                <p className="publish-ubicacion-hint" style={{ marginTop: 8 }}>
                  No perteneces a ningún grupo. Crea uno o únete en la pestaña <strong>Grupos</strong>.
                </p>
              )}
            </div>
          )}
        </div>

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
              <div className="publish-filtro-catalogo-block">
                <p className="publish-ubicacion-title">Filtrar plantillas del catálogo</p>
                <p className="publish-ubicacion-hint">
                  Opcional: mismo criterio que en «Rutas» — filtra plantillas por la comunidad y provincia guardadas al crearlas.
                </p>
                <div className="form-group">
                  <label htmlFor="publish-filtro-ccaa">Comunidad autónoma</label>
                  <select
                    id="publish-filtro-ccaa"
                    className="publish-modal-control"
                    value={filtListaCcaa}
                    onChange={(e) => {
                      setFiltListaCcaa(e.target.value)
                      setFiltListaProvincia('')
                    }}
                  >
                    <option value="">Todas</option>
                    {COMUNIDADES_AUTONOMAS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="publish-filtro-provincia">Provincia</label>
                  <select
                    id="publish-filtro-provincia"
                    className="publish-modal-control"
                    value={filtListaProvincia}
                    onChange={(e) => setFiltListaProvincia(e.target.value)}
                    disabled={!filtListaCcaa}
                  >
                    <option value="">Todas (de la CCAA)</option>
                    {provinciasFiltroLista.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <p className="loading-text">Cargando rutas...</p>
              ) : rutas.length === 0 ? (
                <p className="no-routes">No hay plantillas con estos filtros. Cambia CCAA/provincia o crea una nueva.</p>
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
                      {rutas.map((ruta) => {
                        const z =
                          ruta.ubicacion_region || ruta.ubicacion_ciudad
                            ? `${nombreComunidad(ruta.ubicacion_region) || ruta.ubicacion_region || '—'} · ${nombreProvincia(ruta.ubicacion_ciudad) || ruta.ubicacion_ciudad || '—'}`
                            : 'Sin zona en catálogo'
                        return (
                          <option key={ruta.id} value={ruta.id}>
                            {ruta.nombre} — {z}
                          </option>
                        )
                      })}
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
              <div className="publish-filtro-catalogo-block">
                <p className="publish-ubicacion-title">Zona de la plantilla en el catálogo (España) *</p>
                <p className="publish-ubicacion-hint">
                  Obligatorio: es la zona que tendrá la salida publicada y la que usará la página Rutas para filtrar y buscar.
                </p>
                <div className="form-group">
                  <label htmlFor="create-catalogo-ccaa">Comunidad autónoma</label>
                  <select
                    id="create-catalogo-ccaa"
                    className="publish-modal-control"
                    value={catalogoCcaa}
                    onChange={(e) => {
                      setCatalogoCcaa(e.target.value)
                      setCatalogoProvincia('')
                    }}
                  >
                    <option value="">— Elige —</option>
                    {COMUNIDADES_AUTONOMAS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="create-catalogo-provincia">Provincia</label>
                  <select
                    id="create-catalogo-provincia"
                    className="publish-modal-control"
                    value={catalogoProvincia}
                    onChange={(e) => setCatalogoProvincia(e.target.value)}
                    disabled={!catalogoCcaa}
                  >
                    <option value="">— Elige —</option>
                    {provinciasCatalogoNueva.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
