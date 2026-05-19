import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { bearingAlongPolyline, smoothBearing } from '../utils/routeBearing'
import {
  isRouteGeoInputEmpty,
  parseLineStringFeatureFromRoute,
  lngLatObjectsFromRoute
} from '../utils/navigationRouteGeoJson'
import './NavigationDriveMap.css'
import NavigationDriveLeafletFallback from './NavigationDriveLeafletFallback'

/** Velo de carga: `idle` espera todas las teselas (en red lenta tarda mucho); esto acota el tiempo. */
const TILES_READY_MAX_WAIT_MS = 2200

/** Por debajo de ~0,7 km/h muchos GPS no dan `heading` fiable; encima usamos el rumbo del dispositivo si viene. */
const MIN_SPEED_MPS_FOR_GPS_HEADING = 0.2

/** Teselas día vía CDN Carto (mejor compatibilidad WebGL/CORS que tile.openstreetmap.org directo). */
const CARTO_DAY_RASTER_STYLE = {
  version: 8,
  sources: {
    cartoDay: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution:
        '<a href="https://carto.com/attributions" target="_blank" rel="noreferrer">© CARTO</a> © OpenStreetMap',
      maxzoom: 19
    }
  },
  layers: [
    {
      id: 'carto-day-base',
      type: 'raster',
      source: 'cartoDay',
      minzoom: 0,
      maxzoom: 22
    }
  ]
}

/** Carto Dark Matter raster (modo noche). */
const NIGHT_RASTER_STYLE = {
  version: 8,
  sources: {
    cartoDark: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution:
        '<a href="https://carto.com/attributions" target="_blank" rel="noreferrer">© CARTO</a> © OpenStreetMap',
      maxzoom: 19
    }
  },
  layers: [
    {
      id: 'carto-base',
      type: 'raster',
      source: 'cartoDark',
      minzoom: 0,
      maxzoom: 22
    }
  ]
}

function rasterStyleResolved(styleUrl, colorScheme) {
  if (styleUrl?.trim()) return styleUrl.trim()
  return colorScheme === 'night' ? NIGHT_RASTER_STYLE : CARTO_DAY_RASTER_STYLE
}

/** Algunos navegadores/políticas de referrer bloquean teselas si no se envía referrer razonable. */
function mapTileTransformRequest(url, resourceType) {
  if (resourceType === 'Tile') {
    return {
      url,
      referrerPolicy: 'strict-origin-when-cross-origin'
    }
  }
  return { url }
}

function isLikelyWebGLError(err) {
  if (err == null) return false
  const chunks = []
  if (typeof err === 'string') chunks.push(err)
  else {
    chunks.push(String(err?.message || ''))
    chunks.push(String(err?.error?.message || ''))
    chunks.push(String(err?.type || ''))
    try {
      chunks.push(JSON.stringify(err))
    } catch {
      /* ignore */
    }
  }
  const s = chunks.join(' ').toLowerCase()
  return (
    s.includes('webgl') ||
    s.includes('webglcontextcreationerror') ||
    s.includes('bindtocurrentsequence') ||
    s.includes('failed to initialize webgl')
  )
}

function routeLinePalette(colorScheme) {
  if (colorScheme === 'night') {
    return {
      bg: '#3730a3',
      bgOpacity: 0.55,
      line: '#f0abfc',
      lineOpacity: 0.98
    }
  }
  return {
    bg: '#4c1d95',
    bgOpacity: 0.45,
    line: '#e879f9',
    lineOpacity: 0.95
  }
}

/** Zoom objetivo según velocidad (m/s); city ↔ autopista. */
function zoomFromSpeedMps(speedMps) {
  if (speedMps == null || Number.isNaN(speedMps) || speedMps < 0.25) return 17.2
  const kmh = speedMps * 3.6
  if (kmh < 35) return 17.7
  if (kmh < 70) return 17.0
  if (kmh < 110) return 16.1
  return 15.2
}

/** GeoJSON Feature limpio para MapLibre (solo números en coordenadas). */
function normalizeLineStringFeature(feature) {
  const coords = feature.geometry.coordinates.map((pt) => [
    Number(pt[0]),
    Number(pt[1])
  ])
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords }
  }
}

function lineStringBounds(coords) {
  if (!coords?.length) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ]
}

/**
 * Vista tipo «modo navegación»: mapa 3D (inclinación), rotación según rumbo y flecha fija.
 */
export default function NavigationDriveMap({
  routeGeoJson,
  /** { lat, lng, heading?, speed? } — heading en ° desde el norte, speed en m/s */
  userPosition = null,
  height = '400px',
  /**
   * URL de estilo MapLibre (vector). Si no se pasa, se usan teselas raster día/noche.
   */
  styleUrl = null,
  /** `day` | `night` — solo aplica si no hay styleUrl personalizada */
  colorScheme = 'day'
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const smoothBearingRef = useRef(null)
  const tilesReadyRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [tilesReady, setTilesReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [useLeafletFallback, setUseLeafletFallback] = useState(false)

  const coords = useMemo(() => lngLatObjectsFromRoute(routeGeoJson), [routeGeoJson])

  useEffect(() => {
    smoothBearingRef.current = null
  }, [routeGeoJson])

  useEffect(() => {
    setMapReady(false)
    setTilesReady(false)
    setMapError('')
    if (isRouteGeoInputEmpty(routeGeoJson)) return undefined
    if (useLeafletFallback) return undefined

    let cancelled = false
    let map
    let tilesIdleTimer
    let resizeObserver = null

    const resolvedStyle = rasterStyleResolved(styleUrl, colorScheme)
    const palette = routeLinePalette(colorScheme)

    const parsed = parseLineStringFeatureFromRoute(routeGeoJson)
    if (!parsed.ok) {
      const msg =
        parsed.error === 'parse'
          ? 'Recorrido inválido (JSON corrupto o mal guardado).'
          : 'Geometría de ruta no válida (se necesita una línea con al menos 2 puntos).'
      setMapError(msg)
      return undefined
    }

    const normalizedFeature = normalizeLineStringFeature(parsed.feature)
    const c = normalizedFeature.geometry.coordinates

    let rafId = 0
    let frameAttempts = 0
    const maxLayoutFrames = 90

    const failInit = (msg) => {
      if (!cancelled) setMapError(msg)
    }

    const runCreateMap = () => {
      if (cancelled) return
      const container = containerRef.current
      if (!container) {
        if (frameAttempts < maxLayoutFrames) {
          frameAttempts += 1
          rafId = requestAnimationFrame(runCreateMap)
        } else {
          failInit('No se encontró el contenedor del mapa. Recarga la página.')
        }
        return
      }
      const w = container.clientWidth
      const h = container.clientHeight
      if ((w < 2 || h < 2) && frameAttempts < maxLayoutFrames) {
        frameAttempts += 1
        rafId = requestAnimationFrame(runCreateMap)
        return
      }
      if (w < 2 || h < 2) {
        failInit(
          'El mapa no tiene espacio visible (altura o anchura 0). Amplía la ventana, recarga la página o desplázate un poco en la página.'
        )
        return
      }

      const mid = c[Math.floor(c.length / 2)]
      const centerLng = Number(mid[0])
      const centerLat = Number(mid[1])
      if (
        !Number.isFinite(centerLng) ||
        !Number.isFinite(centerLat) ||
        centerLng < -180 ||
        centerLng > 180 ||
        centerLat < -90 ||
        centerLat > 90
      ) {
        failInit('Centro del recorrido no válido para el mapa.')
        return
      }

      try {
        map = new maplibregl.Map({
          container,
          style: resolvedStyle,
          center: [centerLng, centerLat],
          zoom: 13,
          pitch: 0,
          bearing: 0,
          maxPitch: 72,
          attributionControl: true,
          transformRequest: mapTileTransformRequest
        })
        mapRef.current = map
      } catch (err) {
        console.error(err)
        if (!cancelled && isLikelyWebGLError(err)) {
          setUseLeafletFallback(true)
          setMapError('')
          return
        }
        const hint = err?.message ? ` ${String(err.message)}` : ''
        failInit(`No se pudo inicializar el mapa.${hint}`)
        return
      }

      map.on('error', (e) => {
        const errBlob = e?.error || {}
        if (
          !cancelled &&
          isLikelyWebGLError({
            message: errBlob.message || e?.error?.message,
            error: errBlob,
            type: errBlob.type
          })
        ) {
          try {
            map.remove()
          } catch {
            /* ignore */
          }
          mapRef.current = null
          setUseLeafletFallback(true)
          setMapError('')
          return
        }
        if (!cancelled && e?.error?.message) {
          if (!tilesReadyRef.current) {
            try {
              map.remove()
            } catch {
              /* ignore */
            }
            mapRef.current = null
            setMapError(
              'No se pudieron cargar las teselas del mapa. Comprueba la conexión o desactiva bloqueadores.'
            )
          } else {
            console.warn('maplibre:', e.error.message)
          }
        }
      })

      map.on('load', () => {
        if (cancelled || !mapRef.current) return
        try {
          map.addSource('route', { type: 'geojson', data: normalizedFeature })
          map.addLayer({
            id: 'route-line-bg',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': palette.bg,
              'line-width': 12,
              'line-opacity': palette.bgOpacity
            }
          })
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': palette.line,
              'line-width': 6,
              'line-opacity': palette.lineOpacity
            }
          })

          const bb = lineStringBounds(c)
          if (bb) {
            map.fitBounds(bb, { padding: 56, maxZoom: 14, duration: 0 })
          }

          map.resize()
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
              if (!cancelled && mapRef.current === map) {
                try {
                  map.resize()
                } catch {
                  /* ignore */
                }
              }
            })
            resizeObserver.observe(container)
          }

          setMapReady(true)

          let marked = false
          const markTilesReady = () => {
            if (cancelled || marked) return
            marked = true
            if (tilesIdleTimer) window.clearTimeout(tilesIdleTimer)
            tilesIdleTimer = undefined
            tilesReadyRef.current = true
            setTilesReady(true)
          }
          map.once('idle', markTilesReady)
          tilesIdleTimer = window.setTimeout(markTilesReady, TILES_READY_MAX_WAIT_MS)
        } catch (err) {
          console.error(err)
          setMapError('No se pudo dibujar la ruta en el mapa.')
        }
      })
    }

    rafId = requestAnimationFrame(runCreateMap)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      try {
        resizeObserver?.disconnect()
      } catch {
        /* ignore */
      }
      resizeObserver = null
      tilesReadyRef.current = false
      if (tilesIdleTimer) window.clearTimeout(tilesIdleTimer)
      setMapReady(false)
      setTilesReady(false)
      try {
        map?.remove()
      } catch {
        /* ignore */
      }
      mapRef.current = null
    }
  }, [routeGeoJson, styleUrl, colorScheme, height, useLeafletFallback])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map?.getLayer?.('route-line')) return

    const palette = routeLinePalette(colorScheme)
    try {
      map.setPaintProperty('route-line-bg', 'line-color', palette.bg)
      map.setPaintProperty('route-line-bg', 'line-opacity', palette.bgOpacity)
      map.setPaintProperty('route-line', 'line-color', palette.line)
      map.setPaintProperty('route-line', 'line-opacity', palette.lineOpacity)
    } catch {
      /* map puede estar recreándose */
    }
  }, [mapReady, colorScheme])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map?.getSource?.('route')) return

    if (
      !userPosition ||
      userPosition.lat == null ||
      userPosition.lng == null ||
      Number.isNaN(userPosition.lat) ||
      Number.isNaN(userPosition.lng)
    ) {
      return
    }

    const heading = userPosition.heading
    const speed = userPosition.speed
    const gpsHeadingOk =
      heading != null &&
      !Number.isNaN(heading) &&
      speed != null &&
      !Number.isNaN(speed) &&
      speed >= MIN_SPEED_MPS_FOR_GPS_HEADING

    let bearing = gpsHeadingOk
      ? heading
      : bearingAlongPolyline(userPosition.lat, userPosition.lng, coords)

    if (bearing == null || Number.isNaN(bearing)) bearing = map.getBearing()

    const blend = gpsHeadingOk ? 0.32 : 0.16
    smoothBearingRef.current = smoothBearing(smoothBearingRef.current, bearing, blend)
    const b = smoothBearingRef.current

    const targetZoom = zoomFromSpeedMps(speed)
    const zoom = Math.min(Math.max(Math.max(targetZoom, map.getZoom()), 14), 18.6)

    map.easeTo({
      center: [userPosition.lng, userPosition.lat],
      zoom,
      bearing: b,
      pitch: 60,
      duration: 320,
      padding: { top: 110, bottom: 175, left: 36, right: 36 },
      easing: (t) => 1 - (1 - t) ** 2
    })
  }, [mapReady, userPosition, coords])

  if (isRouteGeoInputEmpty(routeGeoJson)) {
    return <div className="navigation-drive-map-error">Sin recorrido para mostrar.</div>
  }

  if (useLeafletFallback) {
    return (
      <NavigationDriveLeafletFallback
        routeGeoJson={routeGeoJson}
        userPosition={userPosition}
        height={height}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <div className="navigation-drive-map-wrap">
      {mapError ? (
        <div className="navigation-drive-map-error-banner" role="alert">
          {mapError}
        </div>
      ) : null}
      {!mapError && !tilesReady ? (
        <p className="navigation-drive-map-loading" role="status">
          <span className="navigation-drive-map-loading-main">Cargando mapa…</span>
          <span className="navigation-drive-map-loading-sub">
            En redes lentas las teselas del mapa pueden tardar unos segundos; la línea de la ruta suele
            mostrarse antes que todo el fondo.
          </span>
        </p>
      ) : null}
      {!userPosition?.lat ? (
        <p className="navigation-drive-map-hint">Esperando señal GPS para modo navegación…</p>
      ) : null}
      <div
        ref={containerRef}
        className="navigation-drive-map-inner"
        style={{ height }}
        role="application"
        aria-label="Mapa de navegación del recorrido"
      />
      {!mapError ? (
        <div className="navigation-drive-chevron" aria-hidden="true">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <polygon
              points="26,5 47,44 26,34 5,44"
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : null}
    </div>
  )
}
