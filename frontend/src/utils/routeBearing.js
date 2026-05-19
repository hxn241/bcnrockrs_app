import { haversineMeters } from './navigationGuidance'
import { lineGeoJsonToLngLatCoords } from './gpx'

/** Rumbo inicial → final en grados (0=N, 90=E, horario). */
export function bearingDegrees(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = (Math.atan2(y, x) * 180) / Math.PI
  return ((θ + 360) % 360)
}

export function coordsFromLineGeoJson(lineGeoJson) {
  try {
    const pairs = lineGeoJsonToLngLatCoords(lineGeoJson)
    return pairs.map(([lng, lat]) => ({ lng, lat }))
  } catch {
    return []
  }
}

/**
 * Rumbo de marcha según el trazo: desde el vértice más cercano, avanza ~lookaheadM por la polilínea
 * y calcula el rumbo hacia ese punto (fallback cuando el GPS no da heading).
 */
/** Índice del vértice más cercano (coords: [{lng,lat}, …] o [[lng,lat], …]). */
export function nearestPolylineVertexIndex(lat, lng, coords) {
  if (!coords?.length) return 0
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < coords.length; i++) {
    const p = coords[i]
    const lngV = Array.isArray(p) ? p[0] : p.lng
    const latV = Array.isArray(p) ? p[1] : p.lat
    const d = haversineMeters(lat, lng, latV, lngV)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function distancePointToSegmentM(lat, lng, segStart, segEnd) {
  const [lng1, lat1] = Array.isArray(segStart) ? segStart : [segStart.lng, segStart.lat]
  const [lng2, lat2] = Array.isArray(segEnd) ? segEnd : [segEnd.lng, segEnd.lat]
  const dPx = haversineMeters(lat, lng, lat1, lng1)
  const dPB = haversineMeters(lat, lng, lat2, lng2)
  const dAB = haversineMeters(lat1, lng1, lat2, lng2)
  if (dAB < 2) return Math.min(dPx, dPB)
  const x = lng - lng1
  const y = lat - lat1
  const x2 = lng2 - lng1
  const y2 = lat2 - lat1
  const t = Math.max(0, Math.min(1, (x * x2 + y * y2) / (x2 * x2 + y2 * y2 + 1e-12)))
  const projLat = lat1 + t * y2
  const projLng = lng1 + t * x2
  return haversineMeters(lat, lng, projLat, projLng)
}

/**
 * Distancia mínima del punto a la polilínea (vértices GeoJSON [lng, lat]).
 */
export function minDistanceToPolylineM(lat, lng, vertices) {
  if (!vertices || vertices.length === 0) return Infinity
  if (vertices.length === 1) {
    const [lngV, latV] = vertices[0]
    return haversineMeters(lat, lng, latV, lngV)
  }
  let min = Infinity
  for (let i = 0; i < vertices.length - 1; i++) {
    min = Math.min(min, distancePointToSegmentM(lat, lng, vertices[i], vertices[i + 1]))
  }
  return min
}

export function bearingAlongPolyline(userLat, userLng, coords, lookaheadM = 85) {
  if (!coords || coords.length < 2) return null

  let bestIdx = 0
  let bestD = Infinity
  for (let i = 0; i < coords.length; i++) {
    const d = haversineMeters(userLat, userLng, coords[i].lat, coords[i].lng)
    if (d < bestD) {
      bestD = d
      bestIdx = i
    }
  }

  let idx = bestIdx
  let lat = coords[idx].lat
  let lng = coords[idx].lng
  let remaining = lookaheadM

  while (idx < coords.length - 1 && remaining > 0) {
    const next = coords[idx + 1]
    const seg = haversineMeters(lat, lng, next.lat, next.lng)
    if (seg < 0.5) {
      idx++
      lat = coords[idx].lat
      lng = coords[idx].lng
      continue
    }
    if (remaining <= seg) {
      const f = remaining / seg
      lat += f * (next.lat - lat)
      lng += f * (next.lng - lng)
      remaining = 0
      break
    }
    remaining -= seg
    idx++
    lat = coords[idx].lat
    lng = coords[idx].lng
  }

  const last = coords[coords.length - 1]
  const endLat = remaining > 0 ? last.lat : lat
  const endLng = remaining > 0 ? last.lng : lng

  return bearingDegrees(userLat, userLng, endLat, endLng)
}

/** Suaviza cambios bruscos de rumbo (grados). */
export function smoothBearing(prev, next, factor = 0.2) {
  if (next == null || Number.isNaN(next)) return prev
  if (prev == null || Number.isNaN(prev)) return next
  let diff = ((next - prev + 540) % 360) - 180
  const v = prev + diff * factor
  return ((v % 360) + 360) % 360
}
