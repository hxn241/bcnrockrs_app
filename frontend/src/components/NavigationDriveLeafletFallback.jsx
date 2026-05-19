import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fixLeafletDefaultIcons } from '../utils/leafletIcons'
import { bearingAlongPolyline, smoothBearing } from '../utils/routeBearing'
import {
  isRouteGeoInputEmpty,
  lngLatObjectsFromRoute,
  parseLineStringFeatureFromRoute
} from '../utils/navigationRouteGeoJson'
import './NavigationDriveMap.css'

fixLeafletDefaultIcons()

const WEBGL_BANNER_STORAGE_KEY = 'kurvemaster_nav_hide_webgl_banner'

const DEFAULT_WEBGL_NOTICE =
  'Vista 2D sin inclinación (no hay WebGL). La flecha indica el sentido de marcha (GPS o el trazado); el mapa sigue tu posición al moverte.'

/** Coherente con NavigationDriveMap (heading solo si hay movimiento mínimo). */
const MIN_SPEED_MPS_FOR_GPS_HEADING = 0.2

function leafletZoomFromSpeedMps(speedMps) {
  if (speedMps == null || Number.isNaN(speedMps) || speedMps < 0.25) return 16
  const kmh = speedMps * 3.6
  if (kmh < 35) return 17
  if (kmh < 70) return 16
  if (kmh < 110) return 15
  return 14
}

/**
 * Vista navegación sin WebGL (VMs, Mesa llvmpipe roto). Leaflet + teselas raster;
 * flecha tipo GPS (sentido de marcha) y seguimiento del centro como en MapLibre sin inclinar el mapa.
 */
export default function NavigationDriveLeafletFallback({
  routeGeoJson,
  userPosition = null,
  height = '400px',
  colorScheme = 'day',
  /** Texto del aviso; `null` usa el predeterminado. `''` oculta el aviso por completo. */
  notice = null
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const userLayerRef = useRef(null)
  const smoothBearingRef = useRef(null)
  /** Rumbo mostrado en la flecha (° horario desde el norte). */
  const [chevronDeg, setChevronDeg] = useState(0)

  const routeCoords = useMemo(() => lngLatObjectsFromRoute(routeGeoJson), [routeGeoJson])
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(WEBGL_BANNER_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismissBanner = () => {
    try {
      sessionStorage.setItem(WEBGL_BANNER_STORAGE_KEY, '1')
    } catch {
      /* modo privado u otro */
    }
    setBannerDismissed(true)
  }

  const noticeText = notice === '' ? null : notice ?? DEFAULT_WEBGL_NOTICE
  const showBanner = Boolean(noticeText) && !bannerDismissed

  useEffect(() => {
    if (isRouteGeoInputEmpty(routeGeoJson) || !containerRef.current) return undefined

    const parsed = parseLineStringFeatureFromRoute(routeGeoJson)
    if (!parsed.ok) return undefined

    const latlngs = parsed.feature.geometry.coordinates.map(([lng, lat]) =>
      L.latLng(lat, lng)
    )

    const map = L.map(containerRef.current, {
      preferCanvas: true,
      zoomControl: true
    })

    const tileUrl =
      colorScheme === 'night'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'

    L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map)

    L.polyline(latlngs, {
      color: '#7c3aed',
      weight: 10,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map)

    L.polyline(latlngs, {
      color: '#e879f9',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map)

    map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48], maxZoom: 14 })

    mapRef.current = map
    userLayerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      userLayerRef.current = null
    }
  }, [routeGeoJson, colorScheme])

  useEffect(() => {
    smoothBearingRef.current = null
    setChevronDeg(0)
  }, [routeGeoJson])

  useEffect(() => {
    const map = mapRef.current
    const ug = userLayerRef.current
    if (!map || !ug) return

    if (
      userPosition?.lat == null ||
      userPosition?.lng == null ||
      Number.isNaN(userPosition.lat) ||
      Number.isNaN(userPosition.lng)
    ) {
      ug.clearLayers()
      return
    }

    const ll = L.latLng(userPosition.lat, userPosition.lng)
    ug.clearLayers()

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
      : bearingAlongPolyline(userPosition.lat, userPosition.lng, routeCoords)

    if (bearing == null || Number.isNaN(bearing)) {
      bearing = smoothBearingRef.current ?? 0
    }

    const blend = gpsHeadingOk ? 0.32 : 0.18
    smoothBearingRef.current = smoothBearing(smoothBearingRef.current, bearing, blend)
    setChevronDeg(smoothBearingRef.current)

    L.circleMarker(ll, {
      radius: 9,
      fillColor: '#2563eb',
      fillOpacity: 1,
      color: '#fff',
      weight: 2
    }).addTo(ug)

    const z = leafletZoomFromSpeedMps(userPosition.speed)
    map.setView(ll, z, { animate: true, duration: 0.28 })
  }, [userPosition, routeCoords, routeGeoJson, colorScheme])

  if (isRouteGeoInputEmpty(routeGeoJson)) {
    return <div className="navigation-drive-map-error">Sin recorrido para mostrar.</div>
  }

  const parsed = parseLineStringFeatureFromRoute(routeGeoJson)
  if (!parsed.ok) {
    return (
      <div className="navigation-drive-map-error-banner" role="alert">
        No se pudo leer el recorrido para el mapa clásico.
      </div>
    )
  }

  const hasGps =
    userPosition?.lat != null &&
    userPosition?.lng != null &&
    !Number.isNaN(userPosition.lat) &&
    !Number.isNaN(userPosition.lng)

  return (
    <div className="navigation-drive-map-wrap navigation-drive-map-wrap--leaflet">
      {showBanner ? (
        <div className="navigation-drive-map-webgl-banner" role="status">
          <p className="navigation-drive-map-webgl-banner-text">{noticeText}</p>
          <button
            type="button"
            className="navigation-drive-map-webgl-banner-dismiss"
            onClick={dismissBanner}
          >
            Ocultar
          </button>
        </div>
      ) : null}
      {!hasGps ? (
        <p className="navigation-drive-map-hint navigation-drive-map-hint--leaflet">
          Esperando señal GPS para seguir tu posición en tiempo real…
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="navigation-drive-map-inner navigation-drive-map-inner--leaflet"
        style={{ height }}
      />
      {hasGps ? (
        <div className="navigation-drive-chevron navigation-drive-chevron--leaflet" aria-hidden="true">
          <div
            className="navigation-drive-chevron-rotate"
            style={{ transform: `rotate(${chevronDeg}deg)` }}
          >
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
        </div>
      ) : null}
    </div>
  )
}
