import { useEffect, useState, useRef, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasPublicadasService, mapsService } from '../services/api'
import NavigationDriveMap from '../components/NavigationDriveMap'
import Navigation from '../components/Navigation'
import { formatApiErrorMessage } from '../utils/apiErrorMessage'
import { lineGeoJsonToLngLatCoords, sampleLngLatCoordsForRouting } from '../utils/gpx'
import { toGeoJsonString } from '../utils/navigationRouteGeoJson'
import {
  haversineMeters,
  formatDistanceMeters,
  formatDurationSeconds,
  instructionEs
} from '../utils/navigationGuidance'
import { minDistanceToPolylineM, nearestPolylineVertexIndex } from '../utils/routeBearing'
import '../styles/NavigateSalida.css'

/** Dos lecturas GPS seguidas cerca del punto de maniobra antes de pasar al siguiente paso. */
const NEAR_MANEUVER_M = 48
const NEAR_STABLE_TICKS = 2

/** Si la distancia al trazado supera este umbral varios ticks seguidos, se pide nueva ruta. */
const OFF_ROUTE_M = 92
const OFF_ROUTE_TICKS = 6
const MIN_RECALC_MS = 14000
const GUIDANCE_GRACE_MS = 9000

function buildRecalcCoordinates(userPos, sampledTemplate, maxWaypoints = 25) {
  if (!userPos || !sampledTemplate?.length) return []
  const k = nearestPolylineVertexIndex(userPos.lat, userPos.lng, sampledTemplate)
  const tail = sampledTemplate.slice(k + 1)
  const tailSampled =
    tail.length >= 2
      ? sampleLngLatCoordsForRouting(tail, Math.min(24, maxWaypoints - 1))
      : tail
  const coords = [[userPos.lng, userPos.lat]]
  for (const p of tailSampled) coords.push(p)
  if (coords.length < 2 && sampledTemplate.length >= 1) {
    coords.push(sampledTemplate[sampledTemplate.length - 1])
  }
  return coords.slice(0, maxWaypoints)
}

export default function NavigateSalida() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userPos, setUserPos] = useState(null)

  const [guidance, setGuidance] = useState(null)
  const [guidanceLoading, setGuidanceLoading] = useState(false)
  const [guidanceFetchFailed, setGuidanceFetchFailed] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const stableNearRef = useRef(0)
  const templateSampledRef = useRef([])
  const offRouteStableRef = useRef(0)
  const lastRecalcAtRef = useRef(0)
  const guidanceLoadedAtRef = useRef(0)
  const [mapColorScheme, setMapColorScheme] = useState('day')
  const [recalcBusy, setRecalcBusy] = useState(false)

  useEffect(() => {
    stableNearRef.current = 0
  }, [stepIndex])

  useEffect(() => {
    if (guidance?.geojson) guidanceLoadedAtRef.current = Date.now()
  }, [guidance?.geojson])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await rutasPublicadasService.getById(id)
        if (cancelled) return
        const r = res.data
        if ((r.ruta?.map_source || 'google') !== 'osm' || !r.ruta?.recorrido_geojson) {
          setError('Esta salida no tiene recorrido en mapa abierto.')
          setRoute(null)
          return
        }
        setRoute(r)
      } catch (err) {
        if (!cancelled) setError(formatApiErrorMessage(err, 'No se pudo cargar la salida.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (user && id) load()
    return () => {
      cancelled = true
    }
  }, [user, id])

  useEffect(() => {
    if (!route?.ruta?.recorrido_geojson) return
    let cancelled = false
    ;(async () => {
      setGuidanceLoading(true)
      setGuidanceFetchFailed(false)
      setGuidance(null)
      setStepIndex(0)
      try {
        const coords = lineGeoJsonToLngLatCoords(
          toGeoJsonString(route.ruta.recorrido_geojson)
        )
        const sampled = sampleLngLatCoordsForRouting(coords, 25)
        templateSampledRef.current = sampled
        const res = await mapsService.routeGuidance(sampled)
        if (cancelled) return
        setGuidance(res.data)
      } catch {
        if (!cancelled) {
          setGuidanceFetchFailed(true)
          setGuidance(null)
        }
      } finally {
        if (!cancelled) setGuidanceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [route?.id, route?.ruta?.recorrido_geojson])

  useEffect(() => {
    if (!route || !navigator.geolocation) return
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const h = pos.coords.heading
        const sp = pos.coords.speed
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: h != null && !Number.isNaN(h) ? h : null,
          speed: sp != null && !Number.isNaN(sp) ? sp : null
        })
      },
      () => {
        /* sin GPS */
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(wid)
  }, [route])

  useEffect(() => {
    if (!userPos || !guidance?.steps?.length) return
    if (stepIndex >= guidance.steps.length) return
    const s = guidance.steps[stepIndex]
    const d = haversineMeters(userPos.lat, userPos.lng, s.location_lat, s.location_lng)
    if (d < NEAR_MANEUVER_M) stableNearRef.current += 1
    else stableNearRef.current = 0

    if (
      stableNearRef.current >= NEAR_STABLE_TICKS &&
      stepIndex < guidance.steps.length - 1
    ) {
      stableNearRef.current = 0
      setStepIndex((i) => i + 1)
    }
  }, [userPos, guidance, stepIndex])

  useEffect(() => {
    if (!userPos?.lat || !guidance?.geojson || guidanceLoading || recalcBusy) return
    if (Date.now() - guidanceLoadedAtRef.current < GUIDANCE_GRACE_MS) return

    let verts
    try {
      verts = lineGeoJsonToLngLatCoords(toGeoJsonString(guidance.geojson))
    } catch {
      return
    }

    const d = minDistanceToPolylineM(userPos.lat, userPos.lng, verts)
    if (d <= OFF_ROUTE_M) {
      offRouteStableRef.current = 0
      return
    }

    offRouteStableRef.current += 1
    if (offRouteStableRef.current < OFF_ROUTE_TICKS) return

    const tpl = templateSampledRef.current
    if (!tpl?.length || tpl.length < 2) return
    if (Date.now() - lastRecalcAtRef.current < MIN_RECALC_MS) return

    lastRecalcAtRef.current = Date.now()
    offRouteStableRef.current = 0

    let cancelled = false
    ;(async () => {
      setRecalcBusy(true)
      try {
        const coords = buildRecalcCoordinates(userPos, tpl)
        if (coords.length < 2) return
        const res = await mapsService.routeGuidance(coords)
        if (cancelled) return
        setGuidance(res.data)
        setStepIndex(0)
      } catch {
        /* mantener guía anterior */
      } finally {
        if (!cancelled) setRecalcBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userPos, guidance?.geojson, guidanceLoading, recalcBusy])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const displayGeoJson =
    toGeoJsonString(guidance?.geojson) || toGeoJsonString(route?.ruta?.recorrido_geojson) || ''

  const hasGuidanceSteps = Boolean(guidance?.steps?.length)

  const guidanceStepsEmpty =
    guidance &&
    !guidanceLoading &&
    Array.isArray(guidance.steps) &&
    guidance.steps.length === 0

  const currentStep = guidance?.steps?.[stepIndex]
  const nextStep =
    hasGuidanceSteps && stepIndex < guidance.steps.length - 1
      ? guidance.steps[stepIndex + 1]
      : null

  const distanceToManeuver = useMemo(() => {
    if (!userPos || !currentStep) return null
    return haversineMeters(
      userPos.lat,
      userPos.lng,
      currentStep.location_lat,
      currentStep.location_lng
    )
  }, [userPos, currentStep])

  if (!user) return null

  const title = route?.ruta?.nombre || 'Recorrido'

  const engineLabel =
    guidance?.engine === 'valhalla'
      ? 'Valhalla'
      : guidance?.engine === 'osrm'
        ? 'OSRM'
        : null

  const mapHeight = hasGuidanceSteps
    ? 'calc(100vh - 300px)'
    : 'calc(100vh - 140px)'

  return (
    <div
      className={`dashboard navigate-salida-page ${hasGuidanceSteps ? 'navigate-salida-page--guided' : ''}`}
    >
      <Navigation user={user} onLogout={handleLogout} />

      <div className="navigate-salida-toolbar">
        <Link to="/dashboard" className="btn btn-secondary navigate-salida-back">
          ← Volver a rutas
        </Link>
        <h1 className="navigate-salida-title">{title}</h1>
        {route ? (
          <button
            type="button"
            className="btn btn-secondary navigate-salida-theme-toggle"
            onClick={() => setMapColorScheme((s) => (s === 'day' ? 'night' : 'day'))}
          >
            {mapColorScheme === 'day' ? 'Modo noche' : 'Modo día'}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="navigate-salida-loading">Cargando…</p>
      ) : error ? (
        <div className="container">
          <div className="error-message">{error}</div>
        </div>
      ) : route ? (
        <>
          {(guidanceLoading || hasGuidanceSteps || guidanceFetchFailed) && (
            <div className="navigate-salida-guidance-wrap">
              {guidanceLoading ? (
                <div className="navigate-salida-guidance navigate-salida-guidance--loading">
                  <p className="navigate-salida-guidance-main">
                    Calculando ruta e indicaciones por carretera…
                  </p>
                  <p className="navigate-salida-guidance-hint">
                    Hasta 25 puntos del recorrido guardado. El backend puede usar Valhalla u OSRM según
                    configuración.
                  </p>
                </div>
              ) : null}

              {guidanceStepsEmpty ? (
                <div className="navigate-salida-guidance-warning" role="status">
                  El servidor no devolvió pasos detallados para esta ruta. Usa la línea del mapa como referencia.
                </div>
              ) : null}

              {guidanceFetchFailed && !guidanceLoading ? (
                <div className="navigate-salida-guidance-warning" role="status">
                  No se pudieron cargar las indicaciones paso a paso (servidor de rutas). Sigue la línea del
                  mapa; intenta de nuevo más tarde.
                </div>
              ) : null}

              {hasGuidanceSteps && currentStep ? (
                <div className="navigate-salida-guidance">
                  <p className="navigate-salida-guidance-meta">
                    <span>Ruta: {formatDistanceMeters(guidance.distance_m)}</span>
                    <span aria-hidden="true"> · </span>
                    <span>ETA: {formatDurationSeconds(guidance.duration_s)}</span>
                    {engineLabel ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="navigate-salida-engine">{engineLabel}</span>
                      </>
                    ) : null}
                    {recalcBusy ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>Recalculando…</span>
                      </>
                    ) : null}
                  </p>
                  <p className="navigate-salida-guidance-dist">
                    {userPos && distanceToManeuver != null && Number.isFinite(distanceToManeuver)
                      ? `En ${formatDistanceMeters(distanceToManeuver)} · Paso ${stepIndex + 1} de ${guidance.steps.length}`
                      : userPos
                        ? `Paso ${stepIndex + 1} de ${guidance.steps.length}`
                        : 'Activa el GPS para ver la distancia al siguiente giro'}
                  </p>
                  <p className="navigate-salida-guidance-main">{instructionEs(currentStep)}</p>
                  {nextStep ? (
                    <p className="navigate-salida-guidance-next">
                      Después: <strong>{instructionEs(nextStep)}</strong>
                    </p>
                  ) : null}
                  <p className="navigate-salida-guidance-hint">
                    La app avanza el paso cuando te acercas al punto de maniobra (unos {NEAR_MANEUVER_M}{' '}
                    m). Si te alejas del trazado unos {OFF_ROUTE_M} m durante varias lecturas GPS, se pide
                    una nueva ruta desde tu posición hasta los puntos que quedan del recorrido guardado.
                    Zoom del mapa según velocidad; modo día/noche arriba a la derecha.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <div className="navigate-salida-map-shell navigate-salida-map-shell--drive">
            <NavigationDriveMap
              routeGeoJson={displayGeoJson}
              userPosition={userPos}
              height={mapHeight}
              colorScheme={mapColorScheme}
            />
          </div>

          <p className="navigate-salida-footnote">
            Vista tipo GPS en el navegador (MapLibre: inclinación, flecha, teselas raster). En móvil el GPS
            puede dar rumbo solo en marcha; si no, el mapa gira según el trazo. El motor de ruta e
            instrucciones puede ser Valhalla u OSRM según el servidor; el recálculo es heurístico (sin voz
            ni datos en tiempo real de tráfico como apps nativas).
          </p>
        </>
      ) : null}
    </div>
  )
}
