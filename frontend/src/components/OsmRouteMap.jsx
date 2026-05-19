import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fixLeafletDefaultIcons } from '../utils/leafletIcons'

fixLeafletDefaultIcons()

/** Por encima de esto no dibujamos marcadores arrastrables (demasiados DOM updates). */
export const OSM_EDIT_MARKER_LIMIT = 48

export function latLngsToLineGeoJson(latlngs) {
  const coordinates = latlngs.map((ll) => [ll.lng, ll.lat])
  return JSON.stringify({ type: 'LineString', coordinates })
}

function parseGeoJsonToLatLngs(s) {
  if (!s || !String(s).trim()) return []
  try {
    const o = JSON.parse(s)
    const coords = o.type === 'LineString' ? o.coordinates : o.geometry?.coordinates
    if (!Array.isArray(coords)) return []
    return coords.map(([lng, lat]) => L.latLng(lat, lng))
  } catch {
    return []
  }
}

/**
 * Mapa Leaflet + teselas OSM. Recorrido como GeoJSON LineString (lng, lat).
 */
export default function OsmRouteMap({
  lineGeoJson,
  editable = false,
  onLineGeoJsonChange,
  /** Si está definido con editable, el clic delega en el padre (sin marcadores arrastrables). */
  onVertexAdded,
  height = 420,
  userLatLng = null,
  showLocateButton = false,
  /** Navegación: encuadra el recorrido una sola vez y centra el mapa en el GPS al moverse. */
  navigationFollowUser = false
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const polylineRef = useRef(null)
  const markersLayerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const canvasRendererRef = useRef(null)
  const latLngsRef = useRef([])
  const clickHandlerRef = useRef(null)
  const navLineKeyRef = useRef('')
  const navFitDoneRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return
    const canvasRenderer = L.canvas({ padding: 0.5 })
    canvasRendererRef.current = canvasRenderer

    const map = L.map(containerRef.current, {
      preferCanvas: true
    }).setView([40.4168, -3.7038], 6)
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map)

    const polyline = L.polyline([], {
      color: '#a21caf',
      weight: 5,
      opacity: 0.92,
      renderer: canvasRenderer
    }).addTo(map)
    polylineRef.current = polyline

    const ml = L.layerGroup().addTo(map)
    markersLayerRef.current = ml

    return () => {
      map.remove()
      mapRef.current = null
      polylineRef.current = null
      markersLayerRef.current = null
      canvasRendererRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const polyline = polylineRef.current
    const ml = markersLayerRef.current
    if (!map || !polyline || !ml) return

    const vertexMode = editable && typeof onVertexAdded === 'function'

    const redrawMarkers = (latlngs) => {
      ml.clearLayers()
      if (!editable || vertexMode) return
      if (latlngs.length > OSM_EDIT_MARKER_LIMIT) return

      latlngs.forEach((pt, idx) => {
        const m = L.marker(pt, { draggable: true })
        m.on('dragend', () => {
          latLngsRef.current[idx] = m.getLatLng()
          polyline.setLatLngs(latLngsRef.current)
          onLineGeoJsonChange?.(latLngsToLineGeoJson(latLngsRef.current))
        })
        m.addTo(ml)
      })
    }

    const lineKey = lineGeoJson || ''
    if (lineKey !== navLineKeyRef.current) {
      navLineKeyRef.current = lineKey
      navFitDoneRef.current = false
    }

    const ll = parseGeoJsonToLatLngs(lineGeoJson)
    latLngsRef.current = ll
    polyline.setLatLngs(ll)
    redrawMarkers(ll)

    if (ll.length) {
      try {
        const shouldFit =
          !navigationFollowUser || !navFitDoneRef.current
        if (shouldFit) {
          map.fitBounds(polyline.getBounds(), { padding: [28, 28], maxZoom: 14 })
          if (navigationFollowUser) navFitDoneRef.current = true
        }
      } catch {
        /* ignore */
      }
    }

    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current)
      clickHandlerRef.current = null
    }
    if (editable && vertexMode) {
      const handler = (e) => {
        onVertexAdded(e.latlng.lng, e.latlng.lat)
      }
      clickHandlerRef.current = handler
      map.on('click', handler)
    } else if (editable && typeof onLineGeoJsonChange === 'function') {
      const handler = (e) => {
        latLngsRef.current.push(e.latlng)
        polyline.setLatLngs(latLngsRef.current)
        redrawMarkers(latLngsRef.current)
        onLineGeoJsonChange(latLngsToLineGeoJson(latLngsRef.current))
      }
      clickHandlerRef.current = handler
      map.on('click', handler)
    }
  }, [lineGeoJson, editable, onLineGeoJsonChange, onVertexAdded, navigationFollowUser])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!userLatLng || userLatLng.lat == null || userLatLng.lng == null) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current)
        userMarkerRef.current = null
      }
      return
    }

    const ll = L.latLng(userLatLng.lat, userLatLng.lng)
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker(ll, {
        radius: 10,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.85,
        weight: 2
      }).addTo(map)
    } else {
      userMarkerRef.current.setLatLng(ll)
    }

    if (navigationFollowUser) {
      map.panTo(ll, { animate: true, duration: 0.3 })
      const z = map.getZoom()
      if (z < 15) map.setZoom(15)
      else if (z > 17) map.setZoom(17)
    }
  }, [userLatLng, navigationFollowUser])

  const handleLocate = () => {
    const map = mapRef.current
    if (!map || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = L.latLng(pos.coords.latitude, pos.coords.longitude)
        map.setView(ll, 14)
      },
      () => {
        /* sin permiso */
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  return (
    <div className="osm-route-map-wrap">
      {showLocateButton ? (
        <button type="button" className="osm-route-map-locate" onClick={handleLocate}>
          Centrar en mi ubicación
        </button>
      ) : null}
      <div
        ref={containerRef}
        className="osm-route-map-container"
        style={{ height, width: '100%' }}
      />
    </div>
  )
}
