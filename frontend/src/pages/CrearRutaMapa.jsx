import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasService, mapsService } from '../services/api'
import Navigation from '../components/Navigation'
import OsmRouteMap from '../components/OsmRouteMap'
import {
  COMUNIDADES_AUTONOMAS,
  provinciasPorComunidad,
  normalizarCodigoProvincia
} from '../constants/espanaUbicacion'
import {
  parseGpxToLatLngPairs,
  latLngPairsToLineGeoJson,
  buildGpxTrack,
  triggerGpxDownload,
  decimateLatLngPairs,
  GPX_IMPORT_MAX_POINTS,
  sampleLngLatCoordsForRouting,
  lngLatWaypointsToLineGeoJson,
  lastLngLatFromLineGeoJson
} from '../utils/gpx'
import { formatApiErrorMessage } from '../utils/apiErrorMessage'
import '../styles/CrearRutaMapa.css'

function countPointsInLineGeoJson(s) {
  if (!s?.trim()) return 0
  try {
    const o = JSON.parse(s)
    const c = o.type === 'LineString' ? o.coordinates : o.geometry?.coordinates
    return Array.isArray(c) ? c.length : 0
  } catch {
    return 0
  }
}

export default function CrearRutaMapa() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [linkEncuentro, setLinkEncuentro] = useState('')
  const [linkRestaurante, setLinkRestaurante] = useState('')
  const [ccaa, setCcaa] = useState('')
  const [provincia, setProvincia] = useState('')
  /** Paradas elegidas por el usuario [[lng, lat], …] */
  const [waypoints, setWaypoints] = useState([])
  /** GPX importado hasta que el usuario empiece a añadir paradas encima */
  const [importedGpxLine, setImportedGpxLine] = useState('')
  const importedGpxRef = useRef('')
  const [routedLineGeoJson, setRoutedLineGeoJson] = useState('')
  const [osrmLoading, setOsrmLoading] = useState(false)
  const [osrmInfo, setOsrmInfo] = useState('')
  const [downloadGpxOnSave, setDownloadGpxOnSave] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState(null)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState([])
  const [placeSearching, setPlaceSearching] = useState(false)
  const [gpxBusy, setGpxBusy] = useState(false)
  const [gpxNote, setGpxNote] = useState('')

  useEffect(() => {
    importedGpxRef.current = importedGpxLine
  }, [importedGpxLine])

  const provinciasCat = provinciasPorComunidad(ccaa)

  const mapDisplayLine = useMemo(() => {
    if (waypoints.length >= 2) {
      if (routedLineGeoJson) return routedLineGeoJson
      return lngLatWaypointsToLineGeoJson(waypoints)
    }
    if (importedGpxLine && waypoints.length === 0) return importedGpxLine
    return ''
  }, [waypoints, routedLineGeoJson, importedGpxLine])

  useEffect(() => {
    if (waypoints.length < 2) {
      setRoutedLineGeoJson('')
      setOsrmInfo('')
      setOsrmLoading(false)
      return
    }

    let cancelled = false
    const t = setTimeout(async () => {
      setOsrmLoading(true)
      try {
        const forOsrm = sampleLngLatCoordsForRouting(waypoints, 25)
        const res = await mapsService.routeOsrm(forOsrm)
        if (cancelled) return
        setRoutedLineGeoJson(res.data.geojson)
        const km =
          res.data.distance_m != null ? (res.data.distance_m / 1000).toFixed(1) : '?'
        const min =
          res.data.duration_s != null ? Math.round(res.data.duration_s / 60) : '?'
        let msg = `Ruta por carretera (OSRM, perfil «driving» — orientativo en moto): ~${km} km, ~${min} min.`
        if (waypoints.length > 25) {
          msg = `Más de 25 paradas: se han repartido hasta 25 puntos para la petición OSRM. ${msg}`
        }
        setOsrmInfo(msg)
        setError('')
      } catch (err) {
        if (cancelled) return
        setRoutedLineGeoJson('')
        setOsrmInfo('')
        setError(
          formatApiErrorMessage(
            err,
            'No se pudo calcular la ruta por carretera. Se muestra la línea recta entre paradas.'
          )
        )
      } finally {
        if (!cancelled) setOsrmLoading(false)
      }
    }, 480)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [waypoints])

  const appendVertex = useCallback((lng, lat) => {
    setWaypoints((w) => {
      const gpx = importedGpxRef.current
      if (gpx && w.length === 0) {
        queueMicrotask(() => {
          importedGpxRef.current = ''
          setImportedGpxLine('')
        })
        try {
          const last = lastLngLatFromLineGeoJson(gpx)
          return [[last[0], last[1]], [lng, lat]]
        } catch {
          return [[lng, lat]]
        }
      }
      return [...w, [lng, lat]]
    })
  }, [])

  const recorridoParaGuardar = useCallback(() => {
    if (routedLineGeoJson) return routedLineGeoJson
    if (waypoints.length >= 2) return lngLatWaypointsToLineGeoJson(waypoints)
    if (importedGpxLine) return importedGpxLine
    return ''
  }, [routedLineGeoJson, waypoints, importedGpxLine])

  const handleUndo = () => {
    setError('')
    setWaypoints((w) => {
      if (w.length <= 1) return []
      return w.slice(0, -1)
    })
  }

  const handleClear = () => {
    importedGpxRef.current = ''
    setImportedGpxLine('')
    setWaypoints([])
    setRoutedLineGeoJson('')
    setOsrmInfo('')
    setGpxNote('')
    setError('')
  }

  const handleSearchPlaces = async (e) => {
    e?.preventDefault()
    const q = placeQuery.trim()
    if (q.length < 2) {
      setError('Escribe al menos 2 caracteres para buscar un lugar.')
      setPlaceResults([])
      return
    }
    setError('')
    setPlaceSearching(true)
    setPlaceResults([])
    try {
      const res = await mapsService.geocode(q, 8)
      setPlaceResults(res.data || [])
      if (!(res.data || []).length) {
        setError('No hay resultados. Prueba con otro nombre o más detalle (provincia).')
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'No se pudo buscar el lugar.'))
    } finally {
      setPlaceSearching(false)
    }
  }

  const addPlaceAsStop = (item) => {
    appendVertex(item.lng, item.lat)
    setPlaceResults([])
    setPlaceQuery('')
    setError('')
  }

  const handleGpxFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setGpxNote('')
    setOsrmInfo('')
    setRoutedLineGeoJson('')
    setWaypoints([])
    setGpxBusy(true)
    try {
      await new Promise((r) => setTimeout(r, 0))
      const text = await file.text()
      await new Promise((r) => setTimeout(r, 0))
      const raw = parseGpxToLatLngPairs(text)
      const pairs = decimateLatLngPairs(raw, GPX_IMPORT_MAX_POINTS)
      const line = latLngPairsToLineGeoJson(pairs)
      importedGpxRef.current = line
      setImportedGpxLine(line)
      if (raw.length > pairs.length) {
        setGpxNote(
          `Track grande (${raw.length} puntos): se ha simplificado a ${pairs.length} para que el editor responda bien. La forma general del recorrido se mantiene.`
        )
      }
    } catch (err) {
      setError(err.message || 'No se pudo leer el GPX.')
    } finally {
      setGpxBusy(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const guardarEnCatalogo = async () => {
    setError('')
    const n = nombre.trim()
    if (!n) {
      setError('Indica un nombre para la ruta.')
      return
    }
    const prov = normalizarCodigoProvincia(provincia)
    if (!ccaa.trim() || !prov) {
      setError('Indica comunidad autónoma y provincia del catálogo.')
      return
    }
    const recorrido = recorridoParaGuardar()
    if (countPointsInLineGeoJson(recorrido) < 2) {
      setError('Dibuja al menos 2 puntos en el mapa o importa un GPX.')
      return
    }

    setBusy(true)
    try {
      const res = await rutasService.createRoute({
        nombre: n,
        map_source: 'osm',
        link_ruta: '',
        link_encuentro: linkEncuentro.trim(),
        link_restaurante: linkRestaurante.trim() || null,
        ubicacion_region: ccaa.trim().toUpperCase(),
        ubicacion_ciudad: prov,
        recorrido_geojson: recorrido
      })
      const created = res.data
      setSavedId(created.id)

      if (downloadGpxOnSave) {
        try {
          const o = JSON.parse(recorrido)
          const coords = o.coordinates
          const pairs = coords.map(([lng, lat]) => [lat, lng])
          triggerGpxDownload(buildGpxTrack(pairs, n), n)
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, 'No se pudo guardar la plantilla.'))
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="dashboard crear-ruta-mapa-page">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="container crear-ruta-mapa-inner">
        <header className="dashboard-heading">
          <h1 className="dashboard-heading-title">Crear ruta (mapa abierto)</h1>
          <div className="dashboard-heading-line" aria-hidden="true" />
          <p className="dashboard-heading-sub">
            Añade paradas en el mapa o por búsqueda; al tener dos o más paradas se calcula solo la unión por
            carretera (OSRM, perfil coche; orientativo en moto). También puedes importar un GPX y, si quieres
            retocar el final, haz clic: el último punto del track se enlaza con la nueva parada. Datos:{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            . El punto de encuentro puede ser un enlace cualquiera o vacío: si lo dejas vacío, el servidor usará
            un enlace al primer punto del recorrido en openstreetmap.org.
          </p>
        </header>

        {error ? <div className="error-message">{error}</div> : null}

        {savedId ? (
          <div className="crear-ruta-mapa-success">
            <p>
              Plantilla guardada (id {savedId}). Puedes publicarla eligiendo la fecha en{' '}
              <Link to="/calendario">Calendario</Link> o revisarla en{' '}
              <Link to="/catalogo">Catálogo de rutas</Link>.
            </p>
          </div>
        ) : null}

        <div className="crear-ruta-mapa-layout">
          <div className="crear-ruta-mapa-map-panel">
            <form className="crear-ruta-mapa-place-search" onSubmit={handleSearchPlaces}>
              <label htmlFor="crm-place-q" className="crear-ruta-mapa-place-label">
                Añadir parada por nombre (pueblo, dirección…)
              </label>
              <div className="crear-ruta-mapa-place-row">
                <input
                  id="crm-place-q"
                  type="search"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="Ej. Begues, Vilanova i la Geltrú…"
                  autoComplete="off"
                  disabled={placeSearching}
                />
                <button type="submit" className="btn btn-secondary" disabled={placeSearching}>
                  {placeSearching ? 'Buscando…' : 'Buscar'}
                </button>
              </div>
              <p className="crear-ruta-mapa-place-policy">
                Búsqueda vía{' '}
                <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">
                  Nominatim
                </a>{' '}
                (OpenStreetMap). Uso moderado; resultados orientados a España.
              </p>
              {placeResults.length > 0 ? (
                <ul className="crear-ruta-mapa-place-results" role="listbox">
                  {placeResults.map((item, i) => (
                    <li key={`${item.lat}-${item.lng}-${i}`}>
                      <button
                        type="button"
                        className="crear-ruta-mapa-place-hit"
                        onClick={() => addPlaceAsStop(item)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </form>

            <OsmRouteMap
              lineGeoJson={mapDisplayLine}
              editable
              onVertexAdded={appendVertex}
              height={440}
              showLocateButton
            />
            <div className="crear-ruta-mapa-map-actions">
              {osrmLoading ? (
                <span className="crear-ruta-mapa-osrm-status" aria-live="polite">
                  Calculando ruta por carretera…
                </span>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={handleUndo}>
                Deshacer último punto
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClear}>
                Borrar trazo
              </button>
              <label className={`btn btn-secondary crear-ruta-mapa-gpx-label ${gpxBusy ? 'is-busy' : ''}`}>
                {gpxBusy ? 'Procesando GPX…' : 'Importar GPX'}
                <input
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  onChange={handleGpxFile}
                  disabled={gpxBusy}
                  hidden
                />
              </label>
            </div>
            {gpxNote ? <p className="crear-ruta-mapa-gpx-note">{gpxNote}</p> : null}
            {osrmInfo ? <p className="crear-ruta-mapa-gpx-note">{osrmInfo}</p> : null}
            <p className="crear-ruta-mapa-hint">
              Con varias paradas el trazado recto se sustituye por la ruta OSRM cuando llegue la respuesta. Si solo
              ves el GPX importado, el primer clic en el mapa enlaza el final del track con tu nueva parada.
            </p>
          </div>

          <div className="crear-ruta-mapa-form-panel">
            <div className="form-group">
              <label htmlFor="crm-nombre">Nombre de la ruta *</label>
              <input
                id="crm-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="publish-filtro-catalogo-block">
              <p className="publish-ubicacion-title">Zona en catálogo (España) *</p>
              <div className="form-group">
                <label htmlFor="crm-ccaa">Comunidad autónoma</label>
                <select
                  id="crm-ccaa"
                  className="publish-modal-control"
                  value={ccaa}
                  onChange={(e) => {
                    setCcaa(e.target.value)
                    setProvincia('')
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
                <label htmlFor="crm-prov">Provincia</label>
                <select
                  id="crm-prov"
                  className="publish-modal-control"
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  disabled={!ccaa}
                >
                  <option value="">— Elige —</option>
                  {provinciasCat.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="crm-encuentro">Punto de encuentro (opcional)</label>
              <input
                id="crm-encuentro"
                type="url"
                value={linkEncuentro}
                onChange={(e) => setLinkEncuentro(e.target.value)}
                placeholder="Google Maps, otro enlace, o vacío → OSM en el 1.º punto del recorrido"
              />
              <p className="crear-ruta-mapa-field-hint">
                Si lo dejas vacío, al guardar se generará un enlace abrible en el navegador al inicio del
                recorrido (OpenStreetMap).
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="crm-rest">Restaurante (opcional)</label>
              <input
                id="crm-rest"
                type="url"
                value={linkRestaurante}
                onChange={(e) => setLinkRestaurante(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>

            <label className="crear-ruta-mapa-checkbox">
              <input
                type="checkbox"
                checked={downloadGpxOnSave}
                onChange={(e) => setDownloadGpxOnSave(e.target.checked)}
              />
              Descargar también un archivo .gpx al guardar
            </label>

            <button
              type="button"
              className="btn btn-primary crear-ruta-mapa-save"
              onClick={guardarEnCatalogo}
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Guardar en el catálogo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
