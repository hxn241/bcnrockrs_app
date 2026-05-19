import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fixLeafletDefaultIcons } from '../utils/leafletIcons'
import {
  isRouteGeoInputEmpty,
  parseLineStringFeatureFromRoute
} from '../utils/navigationRouteGeoJson'
import './NavigationDriveMap.css'

fixLeafletDefaultIcons()

const WEBGL_BANNER_STORAGE_KEY = 'kurvemaster_nav_hide_webgl_banner'

const DEFAULT_WEBGL_NOTICE =
  'Mapa en 2D (norte arriba): aquí no hay WebGL, así que no podemos mostrar la vista inclinada. La ruta y el GPS funcionan igual.'

function leafletZoomFromSpeedMps(speedMps) {
  if (speedMps == null || Number.isNaN(speedMps) || speedMps < 0.25) return 16
  const kmh = speedMps * 3.6
  if (kmh < 35) return 17
  if (kmh < 70) return 16
  if (kmh < 110) return 15
  return 14
}

/**
 * Vista navegación sin WebGL (VMs, Mesa llvmpipe roto, políticas del navegador).
 * Leaflet + teselas raster con etiquetas img; sin inclinación ni rotación tipo GPS.
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
    const gpsOk =
      heading != null &&
      !Number.isNaN(heading) &&
      speed != null &&
      !Number.isNaN(speed) &&
      speed >= 0.45

    if (gpsOk) {
      const hrad = (heading * Math.PI) / 180
      const k = 0.00045
      const dlat = Math.cos(hrad) * k
      const dlng = (Math.sin(hrad) * k) / Math.cos((ll.lat * Math.PI) / 180 || 1e-6)
      const tip = L.latLng(ll.lat + dlat, ll.lng + dlng)
      L.polyline([ll, tip], {
        color: '#2563eb',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round'
      }).addTo(ug)
    }

    L.circleMarker(ll, {
      radius: 9,
      fillColor: '#2563eb',
      fillOpacity: 1,
      color: '#fff',
      weight: 2
    }).addTo(ug)

    map.panTo(ll, { animate: true, duration: 0.22 })
    const z = leafletZoomFromSpeedMps(userPosition.speed)
    if (Math.abs(map.getZoom() - z) >= 1) {
      map.setZoom(z, { animate: true })
    }
  }, [userPosition, routeGeoJson, colorScheme])

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
      <div
        ref={containerRef}
        className="navigation-drive-map-inner navigation-drive-map-inner--leaflet"
        style={{ height }}
      />
    </div>
  )
}
