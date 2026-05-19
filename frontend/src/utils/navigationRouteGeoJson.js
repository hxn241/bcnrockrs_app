/**
 * Normaliza recorrido GeoJSON para navegación: el backend o axios pueden devolver
 * string JSON, objeto ya parseado o JSON doblemente escapado en texto.
 */

export function toGeoJsonString(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value.trim()
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

/**
 * @returns {{ ok: true, feature: GeoJSON Feature } | { ok: false, error: string }}
 */
export function parseLineStringFeatureFromRoute(value) {
  if (value == null || value === '') return { ok: false, error: 'empty' }

  let raw = value

  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return { ok: false, error: 'empty' }
    try {
      raw = JSON.parse(s)
    } catch {
      return { ok: false, error: 'parse' }
    }
    // Doble codificación: "{\"type\":\"LineString\",...}"
    if (typeof raw === 'string') {
      const inner = raw.trim()
      if (!inner.startsWith('{') && !inner.startsWith('[')) {
        return { ok: false, error: 'parse' }
      }
      try {
        raw = JSON.parse(inner)
      } catch {
        return { ok: false, error: 'parse' }
      }
    }
  }

  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid' }

  let geometry = null
  if (raw.type === 'LineString') {
    geometry = raw
  } else if (raw.type === 'Feature' && raw.geometry?.type === 'LineString') {
    geometry = raw.geometry
  }

  const coords = geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) {
    return { ok: false, error: 'geometry' }
  }

  const valid = coords.every(
    (c) =>
      Array.isArray(c) &&
      c.length >= 2 &&
      Number.isFinite(Number(c[0])) &&
      Number.isFinite(Number(c[1]))
  )
  if (!valid) return { ok: false, error: 'coords' }

  const feature =
    raw.type === 'Feature'
      ? { type: 'Feature', geometry, properties: raw.properties || {} }
      : { type: 'Feature', geometry, properties: {} }

  return { ok: true, feature }
}

export function lngLatObjectsFromRoute(value) {
  const pr = parseLineStringFeatureFromRoute(value)
  if (!pr.ok) return []
  return pr.feature.geometry.coordinates.map(([lng, lat]) => ({
    lng: Number(lng),
    lat: Number(lat)
  }))
}

export function isRouteGeoInputEmpty(value) {
  if (value == null || value === '') return true
  if (typeof value === 'string') return !value.trim()
  return false
}
