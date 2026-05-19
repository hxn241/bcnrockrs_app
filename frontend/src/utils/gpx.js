function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** LineString GeoJSON a partir de waypoints [[lng,lat], ...] (mínimo 2 puntos). */
export function lngLatWaypointsToLineGeoJson(waypoints) {
  if (!waypoints || waypoints.length < 2) return ''
  const coordinates = waypoints.map(([lng, lat]) => [Number(lng), Number(lat)])
  return JSON.stringify({ type: 'LineString', coordinates })
}

/** Último vértice [lng, lat] de un LineString (≥1 punto). */
export function lastLngLatFromLineGeoJson(lineGeoJson) {
  if (!lineGeoJson?.trim()) throw new Error('Sin geometría.')
  const o = JSON.parse(lineGeoJson)
  const coords = o.type === 'LineString' ? o.coordinates : o.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 1) throw new Error('Sin coordenadas.')
  const last = coords[coords.length - 1]
  return [Number(last[0]), Number(last[1])]
}

/**
 * Extrae puntos [lat, lng] desde XML GPX (trkpt / rtept).
 * @param {string} xmlText
 * @returns {Array<[number, number]>}
 */
export function parseGpxToLatLngPairs(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('No se pudo leer el archivo GPX.')

  const pts = []
  doc.querySelectorAll('trkpt, rtept').forEach((el) => {
    const lat = parseFloat(el.getAttribute('lat'))
    const lon = parseFloat(el.getAttribute('lon'))
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push([lat, lon])
  })

  if (pts.length < 2) {
    throw new Error('El GPX debe tener al menos 2 puntos (trkpt o rtept).')
  }
  return pts
}

/** Máximo de vértices guardados en el editor tras importar GPX (evita lag en Leaflet). */
export const GPX_IMPORT_MAX_POINTS = 900

/**
 * Reduce puntos conservando inicio y fin (muestreo uniforme).
 * @param {Array<[number, number]>} pairs [lat, lng]
 * @param {number} maxPoints
 */
export function decimateLatLngPairs(pairs, maxPoints = GPX_IMPORT_MAX_POINTS) {
  if (!pairs || pairs.length <= maxPoints) return pairs
  const n = pairs.length
  const out = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * (n - 1)) / Math.max(1, maxPoints - 1))
    out.push(pairs[idx])
  }
  return out
}

/**
 * Añade un punto [lng, lat] al final del LineString.
 * @param {string} lineGeoJson
 * @param {number} lng
 * @param {number} lat
 */
export function appendLngLatToLineGeoJson(lineGeoJson, lng, lat) {
  let coords = []
  if (lineGeoJson?.trim()) {
    try {
      const o = JSON.parse(lineGeoJson)
      if (o.type === 'LineString' && Array.isArray(o.coordinates)) {
        coords = o.coordinates.map((c) => [Number(c[0]), Number(c[1])])
      }
    } catch {
      coords = []
    }
  }
  coords.push([lng, lat])
  return JSON.stringify({ type: 'LineString', coordinates: coords })
}

/**
 * Extrae [[lng, lat], ...] desde un GeoJSON LineString en string.
 * @param {string} lineGeoJson
 * @returns {Array<[number, number]>}
 */
export function lineGeoJsonToLngLatCoords(lineGeoJson) {
  if (!lineGeoJson?.trim()) {
    throw new Error('No hay recorrido.')
  }
  const o = JSON.parse(lineGeoJson)
  const coords = o.type === 'LineString' ? o.coordinates : o.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error('Se necesitan al menos 2 puntos en el trazo.')
  }
  return coords.map((c) => [Number(c[0]), Number(c[1])])
}

/** Para OSRM: como máximo `max` waypoints, muestreando sobre el trazo completo. */
export function sampleLngLatCoordsForRouting(coords, max = 25) {
  if (!coords || coords.length <= max) return coords
  const n = coords.length
  const out = []
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (n - 1)) / Math.max(1, max - 1))
    out.push(coords[idx])
  }
  return out
}

/**
 * GeoJSON LineString compacto (lng, lat).
 * @param {Array<[number, number]>} latLngPairs
 */
export function latLngPairsToLineGeoJson(latLngPairs) {
  const coordinates = latLngPairs.map(([lat, lng]) => [lng, lat])
  return JSON.stringify({ type: 'LineString', coordinates })
}

/**
 * @param {Array<[number, number]>} latLngPairs
 * @param {string} name
 */
export function buildGpxTrack(latLngPairs, name = 'Kurvemaster') {
  const pts = latLngPairs
    .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Kurvemaster" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>${escapeXml(name)}</name><trkseg>
${pts}
  </trkseg></trk>
</gpx>`
}

export function triggerGpxDownload(xmlString, filenameBase) {
  const blob = new Blob([xmlString], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase.replace(/[^a-zA-Z0-9-_]/g, '_') || 'ruta'}.gpx`
  a.click()
  URL.revokeObjectURL(url)
}
